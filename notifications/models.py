from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        LIKE = "like", "Лайк"
        REPOST = "repost", "Репост"
        COMMENT = "comment", "Комментарий"
        FOLLOW = "follow", "Подписка"
        MESSAGE = "message", "Сообщение"

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="notifications_sent")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    post_id = models.PositiveBigIntegerField(null=True, blank=True)
    comment_id = models.PositiveBigIntegerField(null=True, blank=True)
    message_id = models.PositiveBigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"], name="notif_recipient_created"),
            models.Index(fields=["recipient", "read_at"], name="notif_recipient_read"),
        ]
