from django.utils import timezone

from core.http import api_view, get_data, json_response
from core.serializers import avatar_of, display_name, iso
from messaging.models import Message
from .models import Notification


def notification_dict(request, item):
    actor = item.actor
    return {
        "id": item.id,
        "kind": item.kind,
        "actor_name": display_name(actor) if actor else "",
        "actor_username": actor.username if actor else "",
        "avatar_url": avatar_of(request, actor) if actor else None,
        "post_id": item.post_id,
        "comment_id": item.comment_id,
        "message_id": item.message_id,
        "created_at": iso(item.created_at),
        "is_read": item.read_at is not None,
    }


@api_view("GET")
def list_notifications(request):
    user = request.user
    items = list(
        Notification.objects.filter(recipient=user).select_related("actor").order_by("-created_at", "-id")[:100]
    )
    unread_count = Notification.objects.filter(recipient=user, read_at__isnull=True).count()
    unread_messages = Message.objects.filter(recipient=user, read_at__isnull=True).count()
    return json_response({
        "results": [notification_dict(request, item) for item in items],
        "unread_count": unread_count,
        "unread_messages": unread_messages,
    })


@api_view("POST")
def mark_read(request):
    data = get_data(request)
    unread = Notification.objects.filter(recipient=request.user, read_at__isnull=True)
    ids = data.get("ids")
    if data.get("all") is True:
        updated = unread.update(read_at=timezone.now())
    elif isinstance(ids, list):
        safe_ids = [value for value in ids if isinstance(value, int) and value > 0][:100]
        updated = unread.filter(pk__in=safe_ids).update(read_at=timezone.now())
    else:
        updated = 0
    return json_response({"updated": updated})
