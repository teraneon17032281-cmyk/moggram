from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, University, Faculty, Follow, BlockedUser, EmailCode


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "faculty", "email_verified", "is_verified", "is_staff")
    list_filter = UserAdmin.list_filter + ("email_verified", "is_verified", "role")
    search_fields = ("username", "email", "full_name")
    fieldsets = UserAdmin.fieldsets + (
        ("Дополнительная информация", {
            "fields": ("university", "faculty", "role", "full_name", "avatar", "avatar_url", "bio",
                       "is_verified", "email_verified", "last_seen_at")
        }),
        ("Настройки", {
            "classes": ("collapse",),
            "fields": ("theme", "language", "show_online_status", "show_own_anonymous_posts", "show_own_reposts",
                       "show_own_liked_posts", "show_own_commented_posts", "notify_email_updates",
                       "notify_mentions_and_replies"),
        }),
    )


admin.site.register(University)
admin.site.register(Faculty)
admin.site.register(Follow)
admin.site.register(BlockedUser)
admin.site.register(EmailCode)
