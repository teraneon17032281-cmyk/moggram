"""Личные сообщения: переписки, вложения (фото/голосовые), ответы, реакции, пересылка."""
import os
import re
import unicodedata
from uuid import uuid4

from django.core.files.base import ContentFile
from django.db.models import Case, Count, F, IntegerField, Max, Q, When
from django.utils import timezone

from core import throttle
from core.http import ApiError, api_view, as_str, get_data, json_response, positive_int
from core.serializers import avatar_of, display_name, iso, is_online, media_url, relation_sets
from core.uploads import classify_attachment
from users.api_users import get_public_user, is_blocked_between
from users.models import User
from notifications.models import Notification

from .models import Message, MessageReaction

CONTENT_MAX = 4000
HISTORY_LIMIT = 500
EMOJI_MAX_LEN = 16
ATTACHMENT_LABELS = {"image": "Фото", "audio": "Голосовое сообщение"}


def message_qs():
    return Message.objects.select_related("sender", "recipient", "reply_to", "reply_to__sender").prefetch_related("reactions")


def reactions_summary(message, viewer_id):
    order, counts, mine = [], {}, set()
    for reaction in message.reactions.all():
        if reaction.emoji not in counts:
            counts[reaction.emoji] = 0
            order.append(reaction.emoji)
        counts[reaction.emoji] += 1
        if reaction.user_id == viewer_id:
            mine.add(reaction.emoji)
    return [{"emoji": e, "count": counts[e], "reacted_by_me": e in mine} for e in order]


def message_dict(request, message):
    reply = message.reply_to
    return {
        "id": message.id,
        "content": message.content,
        "created_at": iso(message.created_at),
        "is_read": message.read_at is not None,
        "sender_id": message.sender_id,
        "sender_name": display_name(message.sender),
        "sender_username": message.sender.username,
        "recipient_username": message.recipient.username,
        "attachment_url": media_url(request, message.attachment),
        "attachment_type": message.attachment_type or None,
        "attachment_name": message.attachment_name or None,
        "reply_to": None if not reply else {
            "id": reply.id,
            "content": reply.content or ATTACHMENT_LABELS.get(reply.attachment_type, ""),
            "sender_name": display_name(reply.sender),
        },
        "reactions": reactions_summary(message, request.user.id),
    }


def conversation_filter(a, b):
    return Q(sender=a, recipient=b) | Q(sender=b, recipient=a)


def accessible_message(request, message_id):
    """Сообщение, в переписке которого участвует текущий пользователь (иначе 404, чтобы не раскрывать чужие id)."""
    message = message_qs().filter(Q(sender=request.user) | Q(recipient=request.user), pk=message_id).first()
    if not message:
        raise ApiError("message_not_found", 404)
    return message


def get_recipient(request, username):
    recipient = get_public_user(as_str(username, 50))
    if recipient.pk == request.user.pk:
        raise ApiError("cannot_message_self", 400, message="Нельзя написать самому себе.")
    if is_blocked_between(request.user, recipient):
        raise ApiError("blocked", 403, message="Вы не можете писать этому пользователю.")
    return recipient


def safe_filename(name):
    base = os.path.basename(name or "")
    base = re.sub(r"[\x00-\x1f\x7f]", "", base)
    return base[:255]


# --- Список переписок и сообщения --------------------------------------------------------------------

@api_view("GET")
def conversations(request):
    me = request.user
    partner = Case(When(sender=me, then=F("recipient_id")), default=F("sender_id"), output_field=IntegerField())
    rows = (
        Message.objects.filter(Q(sender=me) | Q(recipient=me))
        .annotate(partner=partner).values("partner")
        .annotate(last_id=Max("id"), unread_count=Count("id", filter=Q(recipient=me, read_at__isnull=True))).order_by("-last_id")
    )[:200]
    last_ids = [row["last_id"] for row in rows]
    messages = {m.pk: m for m in message_qs().filter(pk__in=last_ids)}

    unread_by_partner = {row["partner"]: row["unread_count"] for row in rows}
    partner_ids = []
    for pk in last_ids:
        m = messages[pk]
        partner_ids.append(m.recipient_id if m.sender_id == me.id else m.sender_id)
    users = {u.pk: u for u in User.objects.filter(pk__in=partner_ids, is_active=True, email_verified=True)}
    _, related = relation_sets(me, partner_ids)

    results = []
    for pk, partner_id in zip(last_ids, partner_ids):
        user = users.get(partner_id)
        if not user:
            continue
        item = {
            "username": user.username,
            "full_name": display_name(user),
            "avatar_url": avatar_of(request, user),
            "last_message": message_dict(request, messages[pk]),
            "unread_count": unread_by_partner.get(partner_id, 0),
        }
        if user.pk in related:
            item["is_online"] = is_online(user)
        results.append(item)
    return json_response({"results": results})


@api_view("GET", "POST")
def messages(request):
    if request.method == "GET":
        other = get_public_user(as_str(request.GET.get("with"), 50))
        unread = Message.objects.filter(
            conversation_filter(request.user, other), recipient=request.user, read_at__isnull=True
        )
        unread_ids = list(unread.values_list("id", flat=True))
        unread.update(read_at=timezone.now())
        if unread_ids:
            Notification.objects.filter(recipient=request.user, kind=Notification.Kind.MESSAGE, message_id__in=unread_ids, read_at__isnull=True).update(read_at=timezone.now())
        limit = positive_int(request.GET.get("limit"), HISTORY_LIMIT, HISTORY_LIMIT)
        items = list(message_qs().filter(conversation_filter(request.user, other)).order_by("-created_at", "-id")[:limit])
        items.reverse()
        return json_response({"results": [message_dict(request, m) for m in items]})
    return send_message(request)


def send_message(request):
    throttle.check(f"message:{request.user.pk}", limit=120, window=600)
    data = get_data(request)
    recipient = get_recipient(request, data.get("recipient_username"))

    content = as_str(data.get("content"))
    upload = request.FILES.get("attachment")
    if len(content) > CONTENT_MAX:
        raise ApiError("validation_error", 400, errors={"content": [f"Не более {CONTENT_MAX} символов."]})
    if not content and not upload:
        raise ApiError("validation_error", 400, errors={"content": ["Сообщение не может быть пустым."]})

    reply_to = None
    reply_id = data.get("reply_to_id")
    if reply_id not in (None, ""):
        try:
            reply_to = Message.objects.filter(conversation_filter(request.user, recipient)).get(pk=int(reply_id))
        except (ValueError, TypeError, Message.DoesNotExist):
            raise ApiError("validation_error", 400, errors={"reply_to_id": ["Нельзя ответить на это сообщение."]})

    message = Message(sender=request.user, recipient=recipient, content=content, reply_to=reply_to)
    if upload:
        kind, ext = classify_attachment(upload)
        message.attachment_type = kind
        message.attachment_name = safe_filename(upload.name)
        upload.name = f"{uuid4().hex}.{ext}"
        message.attachment = upload
    message.save()
    Notification.objects.create(recipient=recipient, actor=request.user, kind=Notification.Kind.MESSAGE, message_id=message.pk)
    return json_response(message_dict(request, message_qs().get(pk=message.pk)), status=201)


# --- Реакции и пересылка -----------------------------------------------------------------------------

def valid_emoji(value):
    if not value or len(value) > EMOJI_MAX_LEN:
        return False
    # Эмодзи — это символы, модификаторы и ZWJ; буквы любого алфавита не пропускаем.
    banned = ("L", "Z", "Cc", "Cs", "Co", "Cn")
    return not any(unicodedata.category(ch).startswith(banned) for ch in value)


@api_view("POST")
def toggle_reaction(request, message_id):
    message = accessible_message(request, message_id)
    emoji = as_str(get_data(request).get("emoji"), 40)
    if not valid_emoji(emoji):
        raise ApiError("validation_error", 400, errors={"emoji": ["Некорректная реакция."]})

    reaction, created = MessageReaction.objects.get_or_create(message=message, user=request.user, emoji=emoji)
    if not created:
        reaction.delete()
    fresh = message_qs().get(pk=message.pk)
    return json_response({"reactions": reactions_summary(fresh, request.user.id)})


@api_view("POST")
def forward_message(request, message_id):
    source = accessible_message(request, message_id)
    recipient = get_recipient(request, get_data(request).get("recipient_username"))
    throttle.check(f"message:{request.user.pk}", limit=120, window=600)

    forwarded = Message(sender=request.user, recipient=recipient, content=source.content)
    if source.attachment:
        try:
            with source.attachment.open("rb") as handle:
                payload = handle.read()
        except (OSError, ValueError):
            payload = None  # файл пропал с диска — пересылаем только текст
        if payload is not None:
            ext = os.path.splitext(source.attachment.name)[1] or ""
            forwarded.attachment.save(f"{uuid4().hex}{ext}", ContentFile(payload), save=False)
            forwarded.attachment_type = source.attachment_type
            forwarded.attachment_name = source.attachment_name
    if not forwarded.content and not forwarded.attachment:
        raise ApiError("nothing_to_forward", 400, message="В этом сообщении нечего пересылать.")
    forwarded.save()
    Notification.objects.create(recipient=recipient, actor=request.user, kind=Notification.Kind.MESSAGE, message_id=forwarded.pk)
    return json_response(message_dict(request, message_qs().get(pk=forwarded.pk)), status=201)
