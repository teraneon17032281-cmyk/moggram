import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("like", "Лайк"), ("repost", "Репост"), ("comment", "Комментарий"), ("follow", "Подписка"), ("message", "Сообщение")], max_length=16)),
                ("post_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("comment_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("message_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("read_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications_sent", to=settings.AUTH_USER_MODEL)),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(model_name="notification", index=models.Index(fields=["recipient", "-created_at"], name="notif_recipient_created")),
        migrations.AddIndex(model_name="notification", index=models.Index(fields=["recipient", "read_at"], name="notif_recipient_read")),
    ]
