"""Проверка загружаемых файлов по содержимому, а не по расширению или Content-Type."""
from PIL import Image

from .http import ApiError

MB = 1024 * 1024
IMAGE_EXT = {"JPEG": "jpg", "PNG": "png", "GIF": "gif", "WEBP": "webp"}

IMAGE_FTYP_BRANDS = {b"avif", b"avis", b"heic", b"heix", b"hevc", b"mif1", b"msf1"}

POST_IMAGE_MAX = 10 * MB
AVATAR_MAX = 5 * MB
MESSAGE_IMAGE_MAX = 10 * MB
# Голосовое — максимум 2 минуты (это ограничивает сам фронтенд). Сервер дополнительно режет по размеру:
# 2 минуты даже в хорошем качестве укладываются в 4 МБ.
VOICE_MAX = 4 * MB


def validate_image(upload, max_bytes):
    """Проверяет, что файл — настоящее изображение JPEG/PNG/GIF/WEBP. Возвращает расширение."""
    if upload.size > max_bytes:
        raise ApiError("file_too_large", 400, message=f"Файл больше {max_bytes // MB} МБ.")
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            fmt = img.format
            img.verify()
    except Exception:
        raise ApiError("invalid_image", 400, message="Файл не похож на изображение.")
    finally:
        upload.seek(0)
    if fmt not in IMAGE_EXT:
        raise ApiError("unsupported_image_type", 400, message="Допустимы JPEG, PNG, GIF и WEBP.")
    return IMAGE_EXT[fmt]


def sniff_audio(head):
    """Определяет аудиоконтейнер по сигнатуре. Возвращает расширение или None."""
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    if head[:4] == b"OggS":
        return "ogg"
    if head[4:8] == b"ftyp":
        # HEIC/AVIF-фото тоже начинаются с «ftyp» — их аудио не считаем.
        if head[8:12] in IMAGE_FTYP_BRANDS:
            return None
        return "m4a"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return "mp3"
    return None


def validate_audio(upload):
    if upload.size > VOICE_MAX:
        raise ApiError("file_too_large", 400, message=f"Голосовое сообщение больше {VOICE_MAX // MB} МБ.")
    upload.seek(0)
    head = upload.read(16)
    upload.seek(0)
    ext = sniff_audio(head)
    if not ext:
        raise ApiError("unsupported_audio_type", 400, message="Неподдерживаемый формат аудио.")
    return ext


def classify_attachment(upload):
    """Для сообщений: возвращает (тип, расширение), где тип — 'image' или 'audio'."""
    upload.seek(0)
    head = upload.read(16)
    upload.seek(0)
    if sniff_audio(head):
        return "audio", validate_audio(upload)
    return "image", validate_image(upload, MESSAGE_IMAGE_MAX)
