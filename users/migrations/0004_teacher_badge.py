from django.db import migrations, models


def mark_existing_teachers(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="teacher").update(is_teacher=True)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_existing_users_verified"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_teacher",
            field=models.BooleanField(default=False, verbose_name="Преподаватель"),
        ),
        migrations.RunPython(mark_existing_teachers, migrations.RunPython.noop),
    ]
