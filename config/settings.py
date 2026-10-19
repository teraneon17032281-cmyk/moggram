"""
Настройки Django для MogGram (бэкенд + раздача собранного React-фронтенда).

Секреты и адреса берутся из переменных окружения или из файла `.env` в корне проекта
(см. `.env.example`). Файл `.env` в git не попадает.
"""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path):
    """Минимальный загрузчик .env (KEY=value), чтобы не тащить лишнюю зависимость."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / ".env")


def env(name, default=""):
    value = os.environ.get(name)
    return value if value else default


def env_bool(name, default=False):
    value = os.environ.get(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", True)

_DEV_SECRET = "django-insecure-dev-only-change-me"
SECRET_KEY = env("DJANGO_SECRET_KEY", _DEV_SECRET)
if not DEBUG and SECRET_KEY == _DEV_SECRET:
    raise ImproperlyConfigured("Задайте DJANGO_SECRET_KEY в .env, когда DJANGO_DEBUG=False.")

ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1,moggram-a6a3cufkagdcf6b5.centralindia-01.azurewebsites.net",
)


# --- Приложения ---------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "users",
    "academic",
    "feed",
    "messaging",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# --- База данных ----------------------------------------------------------------

if env("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME"),
            "USER": env("DB_USER"),
            "PASSWORD": env("DB_PASSWORD"),
            "HOST": env("DB_HOST"),
            "PORT": env("DB_PORT", "5432"),
            "OPTIONS": {"sslmode": "require"},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# --- Пароли, язык, время --------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru"
TIME_ZONE = "Asia/Bishkek"
USE_I18N = True
USE_TZ = True


# --- Статика и медиа --------------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR / "media")))

# Папка со сборкой фронтенда (npm run build). Если она есть, Django отдаёт SPA сам.
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"


# --- Фронтенд на другом адресе (режим разработки: Vite на :5173) -------------------

# Адрес фронтенда: используется в ссылке из письма для сброса пароля.
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173").rstrip("/")

_DEV_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
CORS_ALLOWED_ORIGINS = env_list("FRONTEND_ORIGINS", _DEV_ORIGINS)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# Для cross-origin на localhost (разные порты = один "site") подходит Lax.
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30  # «Запомнить меня»: 30 дней
SESSION_COOKIE_SECURE = env_bool("COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("COOKIE_SECURE", not DEBUG)


# --- Почта ---------------------------------------------------------------------------


EMAIL_HOST = env("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", f"MogGram <{EMAIL_HOST_USER or 'no-reply@moggram.local'}>")

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend" if EMAIL_HOST_USER else "django.core.mail.backends.console.EmailBackend",
)

# Параметры кода подтверждения
EMAIL_CODE_TTL = 10 * 60        # срок жизни, сек
EMAIL_CODE_RESEND_AFTER = 60    # пауза между отправками, сек
EMAIL_CODE_MAX_ATTEMPTS = 5     # неверных попыток до блокировки
EMAIL_CODE_LOCK_SECONDS = 5 * 60
