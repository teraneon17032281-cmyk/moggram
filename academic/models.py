from django.db import models
from django.conf import settings
from users.models import Faculty
from django.core.exceptions import ValidationError
from django.db.models import Q

class Subject(models.Model):
    """Учебная дисциплина (предмет)"""
    name = models.CharField(max_length=150, unique=True, verbose_name="Название предмета")
    code = models.CharField(max_length=20, unique=True, verbose_name="Код предмета (например, CS101)")
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Предмет"
        verbose_name_plural = "Предметы"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"

class Teacher(models.Model):
    """Профиль преподавателя"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='teacher_profile',
        verbose_name="Пользователь"
    )
    department = models.CharField(max_length=150, verbose_name="Кафедра")
    bio = models.TextField(blank=True, verbose_name="Информация о преподавателе")

    class Meta:
        verbose_name = "Преподаватель"
        verbose_name_plural = "Преподаватели"

    def __str__(self):
        return f"Преп. {self.user.get_full_name() or self.user.username} ({self.department})"

class Schedule(models.Model):
    """Расписание занятий"""
    WEEKDAY_CHOICES = [
        (1, 'Понедельник'),
        (2, 'Вторник'),
        (3, 'Среда'),
        (4, 'Четверг'),
        (5, 'Пятница'),
        (6, 'Суббота'),
    ]

    faculty = models.ForeignKey(
        Faculty, 
        on_delete=models.CASCADE, 
        related_name='schedules',
        verbose_name="Факультет"
    )
    subject = models.ForeignKey(
        Subject, 
        on_delete=models.CASCADE, 
        related_name='schedules',
        verbose_name="Предмет"
    )
    teacher = models.ForeignKey(
        Teacher, 
        on_delete=models.CASCADE, 
        related_name='schedules',
        verbose_name="Преподаватель"
    )
    
    weekday = models.IntegerField(choices=WEEKDAY_CHOICES, verbose_name="День недели")
    start_time = models.TimeField(verbose_name="Время начала")
    end_time = models.TimeField(verbose_name="Время окончания")
    room = models.CharField(max_length=50, verbose_name="Аудитория")
    course = models.PositiveSmallIntegerField(verbose_name="Курс (1-4)")

    class Meta:
        verbose_name = "Расписание"
        verbose_name_plural = "Расписания"
        ordering = ['faculty', 'weekday', 'start_time']

    def __str__(self):
        return f"{self.get_weekday_display()} | {self.subject.name} ({self.start_time} - {self.end_time})"

    def clean(self):
        super().clean()
        if not self.start_time or not self.end_time:
            return

        if self.start_time >= self.end_time:
            raise ValidationError("Время начала не может быть позже или равным времени окончания.")

        overlapping = Schedule.objects.filter(
            weekday=self.weekday,
            room=self.room
        ).exclude(pk=self.pk)

        time_overlap = overlapping.filter(
            Q(start_time__lt=self.end_time) & Q(end_time__gt=self.start_time)
        )

        if time_overlap.exists():
            raise ValidationError(
                f"Аудитория '{self.room}' уже занята в это время другим занятием ({self.get_weekday_display()})."
            )

def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

class Event(models.Model):
    """Мероприятия ВУЗа"""
    title = models.CharField(max_length=200, verbose_name="Название мероприятия")
    description = models.TextField(verbose_name="Описание")
    date_time = models.DateTimeField(verbose_name="Дата и время проведения")
    location = models.CharField(max_length=150, verbose_name="Место проведения")
    
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='organized_events',
        verbose_name="Организатор"
    )
    
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='attended_events',
        blank=True,
        verbose_name="Участники"
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")

    class Meta:
        verbose_name = "Мероприятие"
        verbose_name_plural = "Мероприятия"
        ordering = ['date_time']


    def __str__(self):
        return f"{self.title} ({self.date_time.strftime('%d.%m.%Y %H:%M')})"