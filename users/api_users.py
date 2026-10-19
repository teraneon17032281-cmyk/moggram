"""Профили, поиск людей, подписки."""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q

from core import throttle
from core.http import ApiError, api_view, as_str, get_data, json_response
from core.serializers import profile_dict, relation_sets, with_profile_counts
from core.uploads import AVATAR_MAX, validate_image
from feed.models import Post

from . import services
from .models import BlockedUser, Follow, User


def public_users():
    return User.objects.filter(is_active=True, email_verified=True)


def get_public_user(username):
    """Пользователь по нику (сначала точное совпадение, затем без учёта регистра)."""
    username = (username or "").lstrip("@")
    qs = public_users()
    user = qs.filter(username=username).first() or qs.filter(username__iexact=username).first()
    if not user:
        raise ApiError("user_not_found", 404)
    return user


def blocked_ids(viewer):
    """Те, кого заблокировал зритель, и те, кто заблокировал его."""
    pairs = BlockedUser.objects.filter(Q(user=viewer) | Q(blocked_user=viewer)).values_list("user_id", "blocked_user_id")
    return {b if a == viewer.id else a for a, b in pairs}


def is_blocked_between(a, b):
    return BlockedUser.objects.filter(
        Q(user=a, blocked_user=b) | Q(user=b, blocked_user=a)
    ).exists()


def profile_for(request, user, own=False):
    """Профиль с счётчиками для одного пользователя."""
    annotated = with_profile_counts(User.objects.filter(pk=user.pk)).get()
    following, related = relation_sets(request.user, [user.pk])
    post_count = Post.objects.filter(author=user).count() if own else None
    return profile_dict(request, annotated, request.user, following, related, post_count=post_count)


@api_view("GET")
def user_list(request):
    """Поиск людей по имени или нику. Публикации и анонимность в поиске не участвуют."""
    query = as_str(request.GET.get("search"), 64).lstrip("@").casefold()
    if not query:
        return json_response({"results": []})

    excluded = blocked_ids(request.user) | {request.user.id}
    # Фильтрация в Python: SQLite не умеет регистронезависимый поиск по кириллице.
    ranked = []
    for pk, username, full_name in public_users().exclude(pk__in=excluded).values_list("id", "username", "full_name"):
        uname, name = username.casefold(), (full_name or "").casefold()
        if query not in uname and query not in name:
            continue
        rank = 0 if uname == query else 1 if uname.startswith(query) or name.startswith(query) else 2
        ranked.append((rank, name or uname, pk))
    ranked.sort()
    ids = [pk for _, _, pk in ranked[:30]]

    users = {u.pk: u for u in with_profile_counts(User.objects.filter(pk__in=ids))}
    following, related = relation_sets(request.user, ids)
    results = [profile_dict(request, users[pk], request.user, following, related) for pk in ids if pk in users]
    return json_response({"results": results})


@api_view("GET")
def user_detail(request, username):
    user = get_public_user(username)
    if user.pk == request.user.pk:
        return json_response(profile_for(request, user, own=True))
    if is_blocked_between(request.user, user):
        raise ApiError("user_not_found", 404)
    return json_response(profile_for(request, user))


@api_view("GET", "POST")
def me_profile(request):
    user = request.user
    if request.method == "GET":
        return json_response(profile_for(request, user, own=True))

    data = get_data(request)
    errors = {}

    full_name = as_str(data.get("full_name", user.full_name), 200)
    if not 2 <= len(full_name) <= 60:
        errors["full_name"] = ["Введите имя от 2 до 60 символов."]

    username = as_str(data.get("username", user.username), 50)
    if username != user.username:  # не трогаем ник, если он не менялся (у старых аккаунтов он мог быть «нестандартным»)
        problem = services.username_problem(username, exclude_pk=user.pk)
        if problem:
            errors["username"] = [problem]

    bio = as_str(data.get("bio", user.bio), 1000)
    if len(bio) > 500:
        errors["bio"] = ["Не более 500 символов."]

    avatar = request.FILES.get("avatar")
    avatar_ext = None
    if avatar:
        try:
            avatar_ext = validate_image(avatar, AVATAR_MAX)
        except ApiError as exc:
            errors["avatar"] = [exc.message or "Не удалось загрузить аватар."]

    if errors:
        raise ApiError("validation_error", 400, errors=errors)

    old_avatar = user.avatar.name if user.avatar else None
    user.full_name, user.username, user.bio = full_name, username, bio
    if avatar:
        from uuid import uuid4

        avatar.name = f"{uuid4().hex}.{avatar_ext}"
        user.avatar = avatar
    try:
        with transaction.atomic():
            user.save()
    except ValidationError as exc:
        raise ApiError("validation_error", 400, errors=getattr(exc, "message_dict", None) or {"username": exc.messages})
    if avatar and old_avatar and old_avatar != user.avatar.name:
        user.avatar.storage.delete(old_avatar)
    return json_response(profile_for(request, user, own=True))


@api_view("POST")
def follow_toggle(request, username):
    target = get_public_user(username)
    if target.pk == request.user.pk:
        raise ApiError("cannot_follow_self", 400, message="Нельзя подписаться на себя.")
    if is_blocked_between(request.user, target):
        raise ApiError("blocked", 403)
    throttle.check(f"follow:{request.user.pk}", limit=120, window=3600)

    link, created = Follow.objects.get_or_create(follower=request.user, following=target)
    if not created:
        link.delete()
    return json_response({
        "following": created,
        "followers_count": Follow.objects.filter(following=target).count(),
    })


@api_view("GET")
def follow_list(request, username, relation):
    """Список подписчиков или подписок публичного профиля."""
    if relation not in {"followers", "following"}:
        raise ApiError("not_found", 404)
    target = get_public_user(username)
    if target.pk != request.user.pk and is_blocked_between(request.user, target):
        raise ApiError("user_not_found", 404)

    if relation == "followers":
        user_ids = Follow.objects.filter(following=target).values_list("follower_id", flat=True)
    else:
        user_ids = Follow.objects.filter(follower=target).values_list("following_id", flat=True)

    excluded = blocked_ids(request.user)
    users = list(with_profile_counts(
        public_users().filter(pk__in=user_ids).exclude(pk__in=excluded)
    ).order_by("username"))
    ids = [person.pk for person in users]
    following, related = relation_sets(request.user, ids)
    return json_response({
        "results": [profile_dict(request, person, request.user, following, related) for person in users]
    })
