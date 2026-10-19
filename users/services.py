"""Логика подтверждения почты, проверки паролей и отправки писем."""
import hashlib
import hmac
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailCode, User

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,20}$")
RESERVED_USERNAMES = {"me"}  # /api/users/me/ — служебный адрес


def normalize_email(value):
    return (value or "").strip().lower()


# --- Валидация -------------------------------------------------------------------------

def username_problem(username, exclude_pk=None):
    if not USERNAME_RE.match(username):
        return "От 3 до 20 символов: латинские буквы, цифры, точка и подчёркивание."
    if username.lower() in RESERVED_USERNAMES:
        return "Это имя зарезервировано."
    taken = User.objects.filter(username__iexact=username)
    if exclude_pk:
        taken = taken.exclude(pk=exclude_pk)
    if taken.exists():
        return "Это имя пользователя уже занято."
    return None


def password_problems(password, user=None):
    problems = []
    if not re.search(r"[a-z]", password):
        problems.append("Добавьте строчную букву.")
    if not re.search(r"[A-Z]", password):
        problems.append("Добавьте заглавную букву.")
    if not re.search(r"\d", password):
        problems.append("Добавьте цифру.")
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        problems.extend(exc.messages)
    return problems


# --- Код подтверждения -----------------------------------------------------------------

def _hash_code(user, code):
    return hmac.new(settings.SECRET_KEY.encode(), f"{user.pk}:{code}".encode(), hashlib.sha256).hexdigest()


def issue_code(user):
    """Создаёт новый 6-значный код (старый перестаёт действовать). Возвращает код открытым текстом."""
    now = timezone.now()
    code = f"{secrets.randbelow(10 ** 6):06d}"
    EmailCode.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": _hash_code(user, code),
            "expires_at": now + timedelta(seconds=settings.EMAIL_CODE_TTL),
            "sent_at": now,
            "attempts": 0,
            "locked_until": None,
        },
    )
    return code


def code_matches(user, record, code):
    return bool(record.code_hash) and hmac.compare_digest(record.code_hash, _hash_code(user, code))


def mark_send_failed(user):
    """Если письмо не ушло, разрешаем запросить код повторно без ожидания."""
    EmailCode.objects.filter(user=user).update(sent_at=timezone.now() - timedelta(hours=1))


def send_code_email(user, code):
    minutes = settings.EMAIL_CODE_TTL // 60
    send_mail(
        subject=f"MogGram: код подтверждения {code}",
        message=(
            f"Здравствуйте, {user.full_name or user.username}!\n\n"
            f"Ваш код подтверждения почты в MogGram: {code}\n"
            f"Он действует {minutes} минут и подходит только один раз.\n\n"
            "Если вы не регистрировались в MogGram, просто проигнорируйте это письмо."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_reset_email(user, link):
    send_mail(
        subject="MogGram: сброс пароля",
        message=(
            f"Здравствуйте, {user.full_name or user.username}!\n\n"
            f"Чтобы задать новый пароль, перейдите по ссылке:\n{link}\n\n"
            "Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль не изменится."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def delivery_payload(user):
    return {
        "email": user.email,
        "code_sent": True,
        "expires_in": settings.EMAIL_CODE_TTL,
        "resend_after": settings.EMAIL_CODE_RESEND_AFTER,
    }
