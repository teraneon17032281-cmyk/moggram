"""Простое ограничение частоты запросов на базе кеша Django.

Для нескольких процессов/серверов в settings.CACHES нужен общий кеш (Redis, Memcached);
LocMemCache по умолчанию работает в пределах одного процесса — для разработки этого достаточно.
"""
import time

from django.core.cache import cache

from .http import ApiError


def client_ip(request):
    # X-Forwarded-For намеренно не используется: его легко подделать без доверенного прокси.
    return request.META.get("REMOTE_ADDR", "unknown")


def check(key, limit, window, code="too_many_attempts"):
    """Считает обращение; при превышении лимита бросает 429 с retry_after."""
    now = time.time()
    cache_key = f"throttle:{key}"
    count, reset_at = cache.get(cache_key) or (0, now + window)
    if reset_at <= now:
        count, reset_at = 0, now + window
    if count >= limit:
        raise ApiError(code, 429, retry_after=max(1, int(reset_at - now)))
    cache.set(cache_key, (count + 1, reset_at), timeout=max(1, int(reset_at - now) + 1))
