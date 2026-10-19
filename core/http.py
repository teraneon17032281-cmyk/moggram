"""Небольшие помощники для JSON API на чистом Django (без DRF).

Формат ошибок совпадает с контрактом фронтенда (frontend/README.md):
    {"code": "invalid_code", "message": "...", "errors": {"email": ["..."]}, "retry_after": 42}
"""
import json
from functools import wraps

from django.http import JsonResponse


class ApiError(Exception):
    """Бросается из любого места view и превращается в JSON-ответ с ошибкой."""

    def __init__(self, code, status=400, message=None, errors=None, retry_after=None):
        super().__init__(code)
        self.code = code
        self.status = status
        self.message = message
        self.errors = errors
        self.retry_after = retry_after

    def response(self):
        body = {"code": self.code}
        if self.message:
            body["message"] = self.message
        if self.errors:
            body["errors"] = self.errors
        if self.retry_after is not None:
            body["retry_after"] = int(self.retry_after)
        resp = json_response(body, status=self.status)
        if self.retry_after is not None and self.status == 429:
            resp["Retry-After"] = str(int(self.retry_after))
        return resp


def json_response(data, status=200):
    return JsonResponse(data, status=status, safe=not isinstance(data, list),
                        json_dumps_params={"ensure_ascii": False})


def error(code, status=400, **kwargs):
    return ApiError(code, status, **kwargs).response()


def api_view(*methods, auth=True):
    """Ограничивает методы, проверяет сессию (401 JSON вместо редиректа) и ловит ApiError."""
    allowed = {m.upper() for m in methods}

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in allowed:
                resp = error("method_not_allowed", 405)
                resp["Allow"] = ", ".join(sorted(allowed))
                return resp
            if auth and not request.user.is_authenticated:
                return error("not_authenticated", 401)
            try:
                return view(request, *args, **kwargs)
            except ApiError as exc:
                return exc.response()

        return wrapper

    return decorator


def get_data(request):
    """Тело запроса как словарь: JSON или multipart/form-data."""
    ctype = (request.content_type or "").lower()
    if ctype == "application/json":
        try:
            data = json.loads(request.body.decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            raise ApiError("invalid_json", 400)
        if not isinstance(data, dict):
            raise ApiError("invalid_json", 400)
        return data
    return request.POST


def as_bool(value, default=False):
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def as_str(value, max_len=None):
    if value is None:
        return ""
    text = value if isinstance(value, str) else str(value)
    text = text.strip()
    return text[:max_len] if max_len else text


def positive_int(value, default, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(number, maximum))
