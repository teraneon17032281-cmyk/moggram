"""Преобразование моделей в JSON-структуры из контракта фронтенда."""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

ONLINE_WINDOW = timedelta(seconds=90)


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def media_url(request, file_field):
    if not file_field:
        return None
    try:
        return request.build_absolute_uri(file_field.url)
    except ValueError:
        return None


def display_name(user):
    return user.full_name or user.username


def avatar_of(request, user):
    return media_url(request, user.avatar) or user.avatar_url or None


def author_dict(request, user):
    return {
        "id": user.id,
        "full_name": display_name(user),
        "username": user.username,
        "is_verified": bool(user.is_verified),
        "avatar_url": avatar_of(request, user),
    }


def is_online(user, now=None):
    """«В сети» — если владелец разрешил показ и heartbeat был не старше 90 секунд."""
    if not user.show_online_status or not user.last_seen_at:
        return False
    return (now or timezone.now()) - user.last_seen_at <= ONLINE_WINDOW


def with_profile_counts(queryset):
    """Добавляет счётчики подписчиков, подписок и публичных (не анонимных) постов."""
    return queryset.annotate(
        followers_total=Count("followers", distinct=True),
        following_total=Count("following", distinct=True),
        public_posts_total=Count("posts", filter=Q(posts__is_anonymous=False), distinct=True),
    )


def relation_sets(viewer, user_ids):
    """(кого читает зритель, с кем у зрителя есть подписка в любую сторону) среди user_ids."""
    from users.models import Follow

    user_ids = list(user_ids)
    if not user_ids:
        return set(), set()
    pairs = Follow.objects.filter(
        Q(follower=viewer, following_id__in=user_ids) | Q(following=viewer, follower_id__in=user_ids)
    ).values_list("follower_id", "following_id")
    following, related = set(), set()
    for follower_id, following_id in pairs:
        if follower_id == viewer.id:
            following.add(following_id)
            related.add(following_id)
        else:
            related.add(follower_id)
    return following, related


def profile_dict(request, user, viewer, following_ids, related_ids, post_count=None):
    """Профиль (CampusProfile). `user` должен быть получен через with_profile_counts()."""
    data = {
        "id": user.id,
        "full_name": display_name(user),
        "username": user.username,
        "avatar_url": avatar_of(request, user),
        "is_verified": bool(user.is_verified),
        "bio": user.bio or "",
        "post_count": user.public_posts_total if post_count is None else post_count,
        "followers_count": user.followers_total,
        "following_count": user.following_total,
        "is_following": user.id in following_ids,
        "show_reposts": user.show_own_reposts,
        "show_liked_posts": user.show_own_liked_posts,
        "show_commented_posts": user.show_own_commented_posts,
    }
    # Статус «в сети» — только тем, у кого есть подписка с этим человеком (в любую сторону).
    if user.id != viewer.id and user.id in related_ids:
        data["is_online"] = is_online(user)
    return data


def session_user_dict(request, user):
    from users.models import Follow

    return {
        "id": user.id,
        "full_name": display_name(user),
        "email": user.email,
        "username": user.username,
        "is_verified": bool(user.is_verified),
        "avatar_url": avatar_of(request, user),
        "followers_count": Follow.objects.filter(following=user).count(),
        "following_count": Follow.objects.filter(follower=user).count(),
    }


def post_dict(request, post):
    """Публикация. Для анонимных автор не раскрывается ни в каком виде."""
    anonymous = post.is_anonymous
    return {
        "id": post.id,
        "content": post.content,
        "is_anonymous": anonymous,
        "created_at": iso(post.created_at),
        "author": None if anonymous else author_dict(request, post.author),
        "like_count": getattr(post, "like_count", 0),
        "comment_count": getattr(post, "comment_count", 0),
        "repost_count": getattr(post, "repost_count", 0),
        "liked_by_me": bool(getattr(post, "liked_by_me", False)),
        "reposted_by_me": bool(getattr(post, "reposted_by_me", False)),
        "image_url": media_url(request, post.image),
        "link_url": post.link_url or None,
    }


def comment_dict(request, comment):
    return {
        "id": comment.id,
        "content": comment.text,
        "created_at": iso(comment.created_at),
        "author": author_dict(request, comment.author),
    }
