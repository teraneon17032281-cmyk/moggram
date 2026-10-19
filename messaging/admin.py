from django.contrib import admin

from .models import Message, MessageReaction


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "recipient", "attachment_type", "created_at")
    list_filter = ("attachment_type", "created_at")
    search_fields = ("sender__username", "recipient__username", "content")
    readonly_fields = ("created_at",)


admin.site.register(MessageReaction)
