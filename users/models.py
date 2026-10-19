from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError


def validate_iuca_email(value):
    """Проверяет, что email заканчивается на @iuca.kg"""
    if not value.endswith('@iuca.kg'):
        raise ValidationError('Регистрация разрешена только для корпоративных почт @iuca.kg')


class University(models.Model):
    name = models.CharField(
        max_length=255, 
        default="International University of Central Asia (IUCA)", 
        verbose_name="Название ВУЗа"
    )
    domain = models.CharField(max_length=100, default="iuca.kg", verbose_name="Домен")
    city = models.CharField(max_length=100, default="Токмок", verbose_name="Город")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")

    class Meta:
        verbose_name = "Университет"
        verbose_name_plural = "Университет"

    def __str__(self):
        return self.name


class Faculty(models.Model):
    university = models.ForeignKey(
        University, 
        on_delete=models.CASCADE, 
        default=1,
        related_name="faculties", 
        verbose_name="Университет"
    )
    name = models.CharField(max_length=255, verbose_name="Название факультета")

    class Meta:
        verbose_name = "Факультет"
        verbose_name_plural = "Факультеты"

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Студент"
        ADMIN = "admin", "Администратор"
        TEACHER = "teacher", "Преподаватель"

    email = models.EmailField(
        unique=True,
        validators=[validate_iuca_email],
        verbose_name="Корпоративный Email",
        error_messages={
            'unique': 'Пользователь с таким email уже зарегистрирован.',
        }
    )

    university = models.ForeignKey(
        University, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        default=1,
        related_name="users",
        verbose_name="Университет"
    )
    faculty = models.ForeignKey(
        Faculty, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="users",
        verbose_name="Факультет"
    )
    role = models.CharField(
        max_length=20, 
        choices=Role.choices, 
        default=Role.STUDENT, 
        verbose_name="Роль"
    )
    full_name = models.CharField(max_length=255, blank=True, verbose_name="Полное имя")
    avatar_url = models.URLField(max_length=500, blank=True, null=True, verbose_name="Ссылка на аватар")
    bio = models.TextField(max_length=500, blank=True, verbose_name="О себе")
    is_verified = models.BooleanField(default=False, verbose_name="Верифицирован")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата регистрации")

    # --- поля для React-фронтенда ---
    email_verified = models.BooleanField(
        default=False,
        verbose_name="Почта подтверждена",
        help_text="Входить в приложение можно только после подтверждения почты кодом.",
    )
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True, verbose_name="Аватар (файл)")
    last_seen_at = models.DateTimeField(null=True, blank=True, verbose_name="Последняя активность")

    # Настройки (POST /api/auth/preferences/)
    theme = models.CharField(max_length=10, choices=[("dark", "Тёмная"), ("light", "Светлая")],
                             default="dark", verbose_name="Тема")
    language = models.CharField(max_length=5, choices=[("ru", "Русский"), ("en", "English")],
                                default="ru", verbose_name="Язык")
    show_online_status = models.BooleanField(default=True, verbose_name="Показывать статус «в сети»")
    show_own_anonymous_posts = models.BooleanField(default=False, verbose_name="Показывать мои анонимные посты в профиле")
    show_own_reposts = models.BooleanField(default=False, verbose_name="Показывать мои репосты")
    show_own_liked_posts = models.BooleanField(default=False, verbose_name="Показывать понравившиеся посты")
    show_own_commented_posts = models.BooleanField(default=False, verbose_name="Показывать мои комментарии")
    notify_email_updates = models.BooleanField(default=True, verbose_name="Уведомления на почту")
    notify_mentions_and_replies = models.BooleanField(default=True, verbose_name="Уведомления об ответах и упоминаниях")

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def clean(self):
        super().clean()
        if self.email:
            validate_iuca_email(self.email)

    def save(self, *args, **kwargs):
        # Полная валидация при обычном сохранении. Точечные обновления (update_fields),
        # например last_login при входе, не должны падать из-за валидации остальных полей.
        if kwargs.get("update_fields") is None:
            self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Follow(models.Model):
    follower = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="following", 
        verbose_name="Подписчик"
    )
    following = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="followers", 
        verbose_name="На кого подписан"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("follower", "following")
        verbose_name = "Подписка"
        verbose_name_plural = "Подписки"


class BlockedUser(models.Model):
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="blocking", 
        verbose_name="Кто заблокировал"
    )
    blocked_user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="blocked_by", 
        verbose_name="Кого заблокировали"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "blocked_user")
        verbose_name = "Заблокированный пользователь"
        verbose_name_plural = "Заблокированные пользователи"


class EmailCode(models.Model):
    """Код подтверждения почты. Хранится только хеш, код одноразовый и с ограниченным сроком."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="email_code")
    code_hash = models.CharField(max_length=64, blank=True)
    expires_at = models.DateTimeField()
    sent_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Код подтверждения почты"
        verbose_name_plural = "Коды подтверждения почты"

    def __str__(self):
        return f"Код для {self.user_id}"
