from django.contrib import admin
from .models import Subject, Teacher, Schedule, Event

admin.site.register(Subject)
admin.site.register(Teacher)
admin.site.register(Schedule)
admin.site.register(Event)