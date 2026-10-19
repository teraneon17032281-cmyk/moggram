from django.conf import settings
from django.db import models


class Message(models.Model):
    """Личное сообщение между двумя пользователями (текст и/или фото/голосовое)."""

    class AttachmentType(models.TextChoices):
        IMAGE = "image", "Фото"
        AUDIO = "audio", "Голосовое"

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="sent_messages", verbose_name="Отправитель")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                  related_name="received_messages", verbose_name="Получатель")
    content = models.TextField(blank=True, verbose_name="Текст")
    attachment = models.FileField(upload_to="messages/", blank=True, null=True, verbose_name="Вложение")
    attachment_type = models.CharField(max_length=10, blank=True, choices=AttachmentType.choices)
    attachment_name = models.CharField(max_length=255, blank=True)
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="replies", verbose_name="Ответ на")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Сообщение"
        verbose_name_plural = "Сообщения"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["sender", "recipient", "created_at"]),
            models.Index(fields=["recipient", "sender", "created_at"]),
        ]

    def __str__(self):
        return f"{self.sender_id} → {self.recipient_id}: {self.content[:30]}"


class MessageReaction(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="message_reactions")
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Реакция на сообщение"
        verbose_name_plural = "Реакции на сообщения"
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["message", "user", "emoji"], name="unique_reaction_per_user_emoji"),
        ]

    def __str__(self):
        return f"{self.emoji} от {self.user_id} на #{self.message_id}"
