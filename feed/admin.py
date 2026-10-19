from django.contrib import admin
from .models import Post, Comment, Repost


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('id', 'author', 'get_content_preview', 'is_anonymous', 'faculty', 'get_likes_count', 'created_at')
    list_filter = ('is_anonymous', 'faculty', 'created_at')
    search_fields = ('content', 'author__username', 'author__email')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    def get_content_preview(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
    get_content_preview.short_description = "Текст поста"

    def get_likes_count(self, obj):
        return obj.likes.count()
    get_likes_count.short_description = "Лайки"


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'author', 'get_text_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('text', 'author__username', 'post__content')
    ordering = ('created_at',)
    readonly_fields = ('created_at',)

    def get_text_preview(self, obj):
        return obj.text[:40] + "..." if len(obj.text) > 40 else obj.text
    get_text_preview.short_description = "Текст комментария"


admin.site.register(Repost)
