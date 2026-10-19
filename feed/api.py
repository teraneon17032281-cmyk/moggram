"""Лента, публикации, лайки, репосты, комментарии и публичные списки активности."""
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q

from core import throttle
from core.http import ApiError, api_view, as_bool, as_str, get_data, json_response, positive_int
from core.serializers import comment_dict, post_dict
from core.uploads import POST_IMAGE_MAX, validate_image
from users.api_users import get_public_user

from .models import Comment, Post, Repost

CONTENT_MAX = 5000
COMMENT_MAX = 1000
LINK_MAX = 500
LIST_LIMIT = 100


def posts_qs(viewer):
    """Публикации со счётчиками и отметками «лайкнул/репостнул я» (без N+1 запросов)."""
    return (
        Post.objects.filter(author__is_active=True)
        .select_related("author")
        .annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
            repost_count=Count("reposts", distinct=True),
            liked_by_me=Exists(Post.likes.through.objects.filter(post_id=OuterRef("pk"), user_id=viewer.pk)),
            reposted_by_me=Exists(Repost.objects.filter(post_id=OuterRef("pk"), user_id=viewer.pk)),
        )
    )


def posts_in_order(ids, viewer):
    found = {p.pk: p for p in posts_qs(viewer).filter(pk__in=ids)}
    return [found[pk] for pk in ids if pk in found]


def get_post(post_id, viewer):
    post = posts_qs(viewer).filter(pk=post_id).first()
    if not post:
        raise ApiError("post_not_found", 404)
    return post


def clean_link(raw):
    link = as_str(raw, LINK_MAX + 1)
    if not link:
        return ""
    if len(link) > LINK_MAX:
        raise ApiError("validation_error", 400, errors={"link_url": ["Ссылка слишком длинная."]})
    try:
        URLValidator(schemes=["http", "https"])(link)  # javascript:/data: и прочее не пропускаем
    except ValidationError:
        raise ApiError("validation_error", 400, errors={"link_url": ["Нужна ссылка вида https://…"]})
    return link


def results(request, posts):
    return json_response({"results": [post_dict(request, p) for p in posts]})


# --- Лента ------------------------------------------------------------------------------------

@api_view("GET", "POST")
def feed(request):
    if request.method == "GET":
        limit = positive_int(request.GET.get("limit"), LIST_LIMIT, 200)
        qs = posts_qs(request.user)
        before = request.GET.get("before")
        if before and before.isdigit():
            qs = qs.filter(pk__lt=int(before))
        return results(request, qs.order_by("-created_at", "-id")[:limit])
    return create_post(request)


def create_post(request):
    throttle.check(f"post:{request.user.pk}", limit=30, window=600)
    data = get_data(request)
    content = as_str(data.get("content"))
    image = request.FILES.get("attachment")

    errors = {}
    if len(content) > CONTENT_MAX:
        errors["content"] = [f"Не более {CONTENT_MAX} символов."]
    elif not content and not image:
        errors["content"] = ["Напишите текст или прикрепите фото."]
    if errors:
        raise ApiError("validation_error", 400, errors=errors)

    link = clean_link(data.get("link_url"))
    image_ext = validate_image(image, POST_IMAGE_MAX) if image else None
    if image:
        image.name = f"{uuid4().hex}.{image_ext}"

    post = Post.objects.create(
        author=request.user,
        content=content,
        link_url=link,
        is_anonymous=as_bool(data.get("is_anonymous")),
        faculty=request.user.faculty,
        image=image or None,
    )
    return json_response(post_dict(request, get_post(post.pk, request.user)), status=201)


@api_view("GET")
def my_posts(request):
    """Только публикации текущего пользователя (включая анонимные) — владелец определяется по сессии."""
    limit = positive_int(request.GET.get("limit"), LIST_LIMIT, 200)
    return results(request, posts_qs(request.user).filter(author=request.user).order_by("-created_at", "-id")[:limit])


# --- Лайки, репосты, комментарии --------------------------------------------------------------------

@api_view("POST")
def toggle_like(request, post_id):
    post = get_post(post_id, request.user)
    with transaction.atomic():
        liked = not Post.likes.through.objects.filter(post_id=post.pk, user_id=request.user.pk).exists()
        if liked:
            post.likes.add(request.user)
        else:
            post.likes.remove(request.user)
    return json_response({"liked": liked, "like_count": Post.likes.through.objects.filter(post_id=post.pk).count()})


@api_view("POST")
def toggle_repost(request, post_id):
    post = get_post(post_id, request.user)
    with transaction.atomic():
        repost, created = Repost.objects.get_or_create(user=request.user, post_id=post.pk)
        if not created:
            repost.delete()
    return json_response({"reposted": created, "repost_count": Repost.objects.filter(post_id=post.pk).count()})


@api_view("GET", "POST")
def comments(request, post_id):
    post = get_post(post_id, request.user)
    if request.method == "GET":
        items = Comment.objects.filter(post_id=post.pk).select_related("author").order_by("created_at", "id")[:500]
        return json_response({"results": [comment_dict(request, c) for c in items]})

    throttle.check(f"comment:{request.user.pk}", limit=60, window=600)
    content = as_str(get_data(request).get("content"))
    if not content:
        raise ApiError("validation_error", 400, errors={"content": ["Комментарий не может быть пустым."]})
    if len(content) > COMMENT_MAX:
        raise ApiError("validation_error", 400, errors={"content": [f"Не более {COMMENT_MAX} символов."]})
    comment = Comment.objects.create(post_id=post.pk, author=request.user, text=content)
    return json_response(comment_dict(request, comment), status=201)


# --- Списки активности пользователей ------------------------------------------------------------------

def resolve_target(request, username):
    """(пользователь, смотрит ли владелец сам). `me` и свой ник дают владельцу полный доступ."""
    if username == "me":
        return request.user, True
    target = get_public_user(username)
    return target, target.pk == request.user.pk


def hide_own_anonymous(target):
    """Исключает анонимные посты самого пользователя из публичных списков — иначе по ним можно вычислить автора."""
    return Q(post__is_anonymous=True, post__author=target)


@api_view("GET")
def user_posts(request, username):
    """Публичные публикации: анонимные скрыты. Свои анонимные — только через /api/posts/mine/."""
    target, _ = resolve_target(request, username)
    qs = posts_qs(request.user).filter(author=target)
    if username != "me":
        qs = qs.filter(is_anonymous=False)
    return results(request, qs.order_by("-created_at", "-id")[:LIST_LIMIT])


@api_view("GET")
def user_reposts(request, username):
    target, owner = resolve_target(request, username)
    if not owner and not target.show_own_reposts:
        return json_response({"results": []})
    qs = Repost.objects.filter(user=target).order_by("-created_at", "-id")
    if not owner:
        qs = qs.exclude(hide_own_anonymous(target))
    ids = list(qs.values_list("post_id", flat=True)[:LIST_LIMIT])
    return results(request, posts_in_order(ids, request.user))


@api_view("GET")
def user_liked_posts(request, username):
    target, owner = resolve_target(request, username)
    if not owner and not target.show_own_liked_posts:
        return json_response({"results": []})
    qs = Post.likes.through.objects.filter(user_id=target.pk).order_by("-id")
    if not owner:
        qs = qs.exclude(Q(post__is_anonymous=True, post__author=target))
    ids = list(qs.values_list("post_id", flat=True)[:LIST_LIMIT])
    return results(request, posts_in_order(ids, request.user))


@api_view("GET")
def user_commented_posts(request, username):
    target, owner = resolve_target(request, username)
    if not owner and not target.show_own_commented_posts:
        return json_response({"results": []})
    qs = Comment.objects.filter(author=target).select_related("author").order_by("-created_at", "-id")
    if not owner:
        qs = qs.exclude(Q(post__is_anonymous=True, post__author=target))
    items = list(qs[:LIST_LIMIT])
    posts = {p.pk: p for p in posts_in_order([c.post_id for c in items], request.user)}
    return json_response({
        "results": [
            {"post": post_dict(request, posts[c.post_id]), "comment": comment_dict(request, c)}
            for c in items if c.post_id in posts
        ]
    })
