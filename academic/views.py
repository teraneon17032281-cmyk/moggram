from core.http import ApiError, api_view, json_response

from .models import Schedule


@api_view("GET")
def schedule_view(request):
    """Расписание факультета текущего пользователя, сгруппированное по дням недели."""
    faculty = request.user.faculty
    if not faculty:
        raise ApiError("faculty_required", 400, message="Для просмотра расписания укажите факультет (его назначает администратор).")

    lessons = Schedule.objects.filter(faculty=faculty).select_related("subject", "teacher__user").order_by("weekday", "start_time")
    days = []
    for number, name in Schedule.WEEKDAY_CHOICES:
        days.append({
            "weekday": number,
            "name": name,
            "lessons": [
                {
                    "subject": s.subject.name,
                    "code": s.subject.code,
                    "teacher": s.teacher.user.full_name or s.teacher.user.username,
                    "start_time": s.start_time.strftime("%H:%M"),
                    "end_time": s.end_time.strftime("%H:%M"),
                    "room": s.room,
                    "course": s.course,
                }
                for s in lessons if s.weekday == number
            ],
        })
    return json_response({"faculty": faculty.name, "days": days})
