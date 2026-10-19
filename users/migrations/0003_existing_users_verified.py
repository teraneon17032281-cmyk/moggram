from django.db import migrations


def forwards(apps, schema_editor):
    User = apps.get_model("users", "User")
    University = apps.get_model("users", "University")

    # Все, кто зарегистрировался до появления подтверждения почты кодом, уже входили
    # с 2FA-кодом на свою @iuca.kg почту — считаем их почту подтверждённой,
    # иначе они не смогли бы войти в новый интерфейс.
    User.objects.filter(email_verified=False).update(email_verified=True)

    # Модель User ссылается на университет с pk=1 по умолчанию.
    if not University.objects.exists():
        University.objects.create(pk=1)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_email_verification_profile_preferences"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
