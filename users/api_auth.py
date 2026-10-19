"""Регистрация, подтверждение почты, вход/выход, настройки (контракт: frontend/README.md)."""
import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.hashers import make_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie

from core import throttle
from core.http import ApiError, api_view, as_bool, as_str, error, get_data, json_response
from core.serializers import session_user_dict

from . import services
from .models import University, User

logger = logging.getLogger(__name__)


# --- CSRF -------------------------------------------------------------------------------

@api_view("GET", auth=False)
@ensure_csrf_cookie
def csrf(request):
    return HttpResponse(status=204)


# --- Регистрация и подтверждение почты -----------------------------------------------------

@api_view("POST", auth=False)
def register(request):
    data = get_data(request)
    throttle.check(f"register:{throttle.client_ip(request)}", limit=20, window=3600)

    full_name = as_str(data.get("full_name"), 200)
    email = services.normalize_email(as_str(data.get("email"), 254))
    username = as_str(data.get("username"), 50)
    password = data.get("password") if isinstance(data.get("password"), str) else ""

    errors = {}
    if not 2 <= len(full_name) <= 60:
        errors["full_name"] = ["Введите имя от 2 до 60 символов."]

    existing = User.objects.filter(email__iexact=email).first() if email else None
    if not email or "@" not in email:
        errors["email"] = ["Введите корректный адрес почты."]
    elif not email.endswith("@iuca.kg"):
        errors["email"] = ["Регистрация разрешена только с корпоративной почтой @iuca.kg."]
    elif existing and existing.email_verified:
        errors["email"] = ["Эта почта уже зарегистрирована."]

    problem = services.username_problem(username, exclude_pk=existing.pk if existing else None)
    if problem:
        errors["username"] = [problem]

    candidate = User(username=username, email=email, full_name=full_name)
    password_errors = services.password_problems(password, user=candidate)
    if password_errors:
        errors["password"] = password_errors

    if errors:
        raise ApiError("validation_error", 400, errors=errors)

    try:
        with transaction.atomic():
            if existing:
                # Незавершённая регистрация с этой почтой: обновляем данные и шлём новый код.
                user = existing
                user.full_name, user.username = full_name, username
                user.set_password(password)
                user.save()
            else:
                user = User.objects.create_user(
                    username=username, email=email, password=password, full_name=full_name,
                    university=University.objects.order_by("id").first(),
                )
            code = services.issue_code(user)
    except ValidationError as exc:
        raise ApiError("validation_error", 400, errors=getattr(exc, "message_dict", None) or {"email": exc.messages})

    try:
        services.send_code_email(user, code)
    except Exception:
        logger.exception("Не удалось отправить код подтверждения на %s", email)
        services.mark_send_failed(user)
        raise ApiError("email_delivery_failed", 502)

    return json_response(services.delivery_payload(user), status=201)


@api_view("POST", auth=False)
def verify_email(request):
    data = get_data(request)
    ip = throttle.client_ip(request)
    throttle.check(f"verify-ip:{ip}", limit=60, window=600)

    email = services.normalize_email(as_str(data.get("email"), 254))
    code = as_str(data.get("code"), 12)

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        raise ApiError("account_not_found", 404)
    if user.email_verified:
        raise ApiError("already_verified", 409)

    record = getattr(user, "email_code", None)
    now = timezone.now()
    if record and record.locked_until and record.locked_until > now:
        raise ApiError("too_many_attempts", 429, retry_after=(record.locked_until - now).total_seconds())
    if not record or not record.code_hash:
        raise ApiError("code_expired", 400)
    if record.expires_at <= now:
        raise ApiError("code_expired", 400)

    if not (code.isdigit() and len(code) == 6 and services.code_matches(user, record, code)):
        record.attempts += 1
        if record.attempts >= settings.EMAIL_CODE_MAX_ATTEMPTS:
            # Код сгорает: нужно запросить новый.
            record.code_hash = ""
            record.attempts = 0
            record.locked_until = now + timedelta(seconds=settings.EMAIL_CODE_LOCK_SECONDS)
            record.save(update_fields=["code_hash", "attempts", "locked_until"])
            raise ApiError("too_many_attempts", 429, retry_after=settings.EMAIL_CODE_LOCK_SECONDS)
        record.save(update_fields=["attempts"])
        raise ApiError("invalid_code", 400)

    with transaction.atomic():
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        record.delete()
    # Подтверждение кодом доказывает владение почтой — сразу создаём сессию, чтобы открылась лента.
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return json_response({"verified": True})


@api_view("POST", auth=False)
def resend_code(request):
    data = get_data(request)
    throttle.check(f"resend-ip:{throttle.client_ip(request)}", limit=30, window=3600)

    email = services.normalize_email(as_str(data.get("email"), 254))
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        raise ApiError("account_not_found", 404)
    if user.email_verified:
        raise ApiError("already_verified", 409)

    record = getattr(user, "email_code", None)
    now = timezone.now()
    if record:
        wait = (record.sent_at + timedelta(seconds=settings.EMAIL_CODE_RESEND_AFTER) - now).total_seconds()
        if wait > 0:
            raise ApiError("resend_too_soon", 429, retry_after=wait)

    code = services.issue_code(user)
    try:
        services.send_code_email(user, code)
    except Exception:
        logger.exception("Не удалось отправить код подтверждения на %s", email)
        services.mark_send_failed(user)
        raise ApiError("email_delivery_failed", 502)
    return json_response(services.delivery_payload(user))


# --- Вход / выход / текущий пользователь -----------------------------------------------------

@api_view("POST", auth=False)
def login_view(request):
    data = get_data(request)
    email = services.normalize_email(as_str(data.get("email"), 254))
    password = data.get("password") if isinstance(data.get("password"), str) else ""
    throttle.check(f"login:{throttle.client_ip(request)}:{email}", limit=10, window=300)

    user = User.objects.filter(email__iexact=email).first() if email else None
    if user is None:
        make_password(password)  # выравниваем время ответа, чтобы не выдавать, что почты нет
        raise ApiError("invalid_credentials", 401)
    if not user.check_password(password) or not user.is_active:
        raise ApiError("invalid_credentials", 401)
    if not user.email_verified:
        raise ApiError("email_not_verified", 403)

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    # «Запомнить меня» — 30 дней, иначе сессия живёт до закрытия браузера.
    request.session.set_expiry(settings.SESSION_COOKIE_AGE if as_bool(data.get("remember")) else 0)
    return json_response({"user": session_user_dict(request, user)})


@api_view("GET")
def me(request):
    return json_response({"user": session_user_dict(request, request.user)})


@api_view("POST", auth=False)
def logout_view(request):
    logout(request)
    return HttpResponse(status=204)


# --- Сброс пароля ---------------------------------------------------------------------------------

@api_view("POST", auth=False)
def password_reset(request):
    """Всегда 200, существует ли адрес или нет, чтобы нельзя было перебирать почты."""
    data = get_data(request)
    email = services.normalize_email(as_str(data.get("email"), 254))
    throttle.check(f"reset:{throttle.client_ip(request)}", limit=10, window=3600)

    user = User.objects.filter(email__iexact=email, email_verified=True, is_active=True).first() if email else None
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
        try:
            services.send_reset_email(user, link)
        except Exception:
            logger.exception("Не удалось отправить письмо для сброса пароля на %s", email)
    return json_response({"accepted": True})


@api_view("POST", auth=False)
def password_reset_confirm(request):
    data = get_data(request)
    throttle.check(f"reset-confirm:{throttle.client_ip(request)}", limit=20, window=600)

    uid, token = as_str(data.get("uid"), 100), as_str(data.get("token"), 100)
    password = data.get("password") if isinstance(data.get("password"), str) else ""

    user = None
    try:
        user = User.objects.filter(pk=force_str(urlsafe_base64_decode(uid)), is_active=True).first()
    except (TypeError, ValueError, OverflowError, UnicodeDecodeError):
        pass
    if not user or not user.email_verified or not default_token_generator.check_token(user, token):
        raise ApiError("invalid_token", 400, message="Ссылка недействительна или устарела. Запросите сброс пароля заново.")

    problems = services.password_problems(password, user=user)
    if problems:
        raise ApiError("validation_error", 400, errors={"password": problems})

    user.set_password(password)
    user.save(update_fields=["password"])
    return json_response({"reset": True})


# --- Настройки и присутствие ------------------------------------------------------------------------

PREF_BOOLS = {
    "show_online_status": "show_online_status",
    "show_own_anonymous_posts": "show_own_anonymous_posts",
    "show_own_reposts": "show_own_reposts",
    "show_own_liked_posts": "show_own_liked_posts",
    "show_own_commented_posts": "show_own_commented_posts",
}


def preferences_payload(user):
    return {
        "theme": user.theme,
        "language": user.language,
        "show_online_status": user.show_online_status,
        "show_own_anonymous_posts": user.show_own_anonymous_posts,
        "show_own_reposts": user.show_own_reposts,
        "show_own_liked_posts": user.show_own_liked_posts,
        "show_own_commented_posts": user.show_own_commented_posts,
        "notifications": {
            "email_updates": user.notify_email_updates,
            "mentions_and_replies": user.notify_mentions_and_replies,
        },
    }


@api_view("GET", "POST")
def preferences(request):
    user = request.user
    if request.method == "GET":
        return json_response(preferences_payload(user))

    data = get_data(request)
    errors = {}
    theme, language = data.get("theme"), data.get("language")
    if theme is not None:
        if theme in {"dark", "light"}:
            user.theme = theme
        else:
            errors["theme"] = ["Допустимо: dark или light."]
    if language is not None:
        if language in {"ru", "en"}:
            user.language = language
        else:
            errors["language"] = ["Допустимо: ru или en."]
    if errors:
        raise ApiError("validation_error", 400, errors=errors)

    for key, attr in PREF_BOOLS.items():
        if key in data:
            setattr(user, attr, as_bool(data.get(key)))
    notifications = data.get("notifications")
    if isinstance(notifications, dict):
        if "email_updates" in notifications:
            user.notify_email_updates = as_bool(notifications["email_updates"])
        if "mentions_and_replies" in notifications:
            user.notify_mentions_and_replies = as_bool(notifications["mentions_and_replies"])

    user.save()
    if not user.show_online_status:
        User.objects.filter(pk=user.pk).update(last_seen_at=None)
    return json_response(preferences_payload(user))


@api_view("POST")
def presence(request):
    """Heartbeat каждые 30 секунд, пока вкладка открыта. visible=false — сразу скрыться."""
    data = get_data(request)
    visible = as_bool(data.get("visible"), default=True) and request.user.show_online_status
    User.objects.filter(pk=request.user.pk).update(last_seen_at=timezone.now() if visible else None)
    return HttpResponse(status=204)
