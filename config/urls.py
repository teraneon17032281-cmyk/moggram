from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve

from core.http import error


def api_not_found(request, path=""):
    return error("not_found", 404)


def spa(request, path=""):
    """Отдаёт собранный React-фронтенд (frontend/dist). Любой неизвестный адрес — index.html (React Router)."""
    dist = settings.FRONTEND_DIST
    index = dist / "index.html"
    if not index.exists():
        return HttpResponse(
            "Фронтенд не собран. Для разработки откройте http://localhost:5173 (npm run dev в папке frontend), "
            "а чтобы Django сам отдавал сайт — выполните `npm run build` в папке frontend.",
            status=404, content_type="text/plain; charset=utf-8",
        )
    if path and (dist / path).is_file():
        return serve(request, path, document_root=dist)
    response = serve(request, "index.html", document_root=dist)
    response["Cache-Control"] = "no-cache"
    return response


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("config.api_urls")),
    re_path(r"^api/(?P<path>.*)$", api_not_found),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Всё остальное — React SPA
urlpatterns += [re_path(r"^(?P<path>(?!(?:api|admin|media|static)(?:/|$)).*)$", spa)]
