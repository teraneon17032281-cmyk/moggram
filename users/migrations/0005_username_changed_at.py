from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_teacher_badge"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username_changed_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="Дата последней смены юзернейма",
            ),
        ),
    ]
