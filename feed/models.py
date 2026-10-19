from django.db import models
from django.conf import settings
from users.models import Faculty

class Post(models.Model):
    """Пост в социальной ленте IUCA Community"""
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts',
        verbose_name="Автор"
    )
    content = models.TextField(blank=True, verbose_name="Текст записи")
    image = models.ImageField(upload_to='posts_images/', blank=True, null=True, verbose_name="Изображение")
    
    link_url = models.URLField(max_length=500, blank=True, verbose_name="Ссылка")
    is_anonymous = models.BooleanField(
        default=False,
        verbose_name="Анонимная публикация",
        help_text="Автор скрыт в публичных ответах API, но остаётся связан с записью в базе.",
    )

    faculty = models.ForeignKey(
        Faculty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts',
        verbose_name="Факультет"
    )
    
    likes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='liked_posts',
        blank=True,
        verbose_name="Лайки"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата публикации")

    class Meta:
        verbose_name = "Пост"
        verbose_name_plural = "Посты"
        ordering = ['-created_at']

    def __str__(self):
        return f"Пост от {self.author.username} ({self.created_at.strftime('%d.%m.%Y %H:%M')})"

    @property
    def total_likes(self):
        return self.likes.count()


class Comment(models.Model):
    """Комментарий к посту"""
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name="Пост"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name="Автор"
    )
    text = models.TextField(verbose_name="Текст комментария")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата комментария")

    class Meta:
        verbose_name = "Комментарий"
        verbose_name_plural = "Комментарии"
        ordering = ['created_at']

    def __str__(self):
        return f"Комментарий от {self.author.username} к посту #{self.post.id}"


class Repost(models.Model):
    """Репост: один пользователь может репостнуть публикацию только один раз."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reposts',
        verbose_name="Кто репостнул"
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='reposts',
        verbose_name="Пост"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Репост"
        verbose_name_plural = "Репосты"
        constraints = [
            models.UniqueConstraint(fields=['user', 'post'], name='unique_repost_per_user_post'),
        ]

    def __str__(self):
        return f"Репост #{self.post_id} от {self.user_id}"
