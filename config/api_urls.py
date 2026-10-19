"""Все маршруты API (/api/...). Порядок важен: `users/me/` должен идти раньше `users/<username>/`."""
from django.urls import path

from academic import views as academic
from feed import api as feed
from messaging import api as messaging
from users import api_auth as auth
from users import api_users as users

urlpatterns = [
    # Авторизация
    path("auth/csrf/", auth.csrf),
    path("auth/register/", auth.register),
    path("auth/verify-email/", auth.verify_email),
    path("auth/resend-code/", auth.resend_code),
    path("auth/login/", auth.login_view),
    path("auth/logout/", auth.logout_view),
    path("auth/me/", auth.me),
    path("auth/password-reset/", auth.password_reset),
    path("auth/password-reset/confirm/", auth.password_reset_confirm),
    path("auth/preferences/", auth.preferences),
    path("auth/presence/", auth.presence),

    # Лента
    path("posts/", feed.feed),
    path("posts/mine/", feed.my_posts),
    path("posts/<int:post_id>/", feed.delete_post),
    path("posts/<int:post_id>/edit/", feed.edit_post),
    path("posts/<int:post_id>/like/", feed.toggle_like),
    path("posts/<int:post_id>/repost/", feed.toggle_repost),
    path("posts/<int:post_id>/comments/", feed.comments),

    # Люди: «me» раньше «<username>»
    path("users/", users.user_list),
    path("users/me/", users.me_profile),
    path("users/<str:username>/followers/", users.follow_list, {"relation": "followers"}),
    path("users/<str:username>/following/", users.follow_list, {"relation": "following"}),
    path("users/<str:username>/", users.user_detail),
    path("users/<str:username>/follow/", users.follow_toggle),
    path("users/<str:username>/posts/", feed.user_posts),
    path("users/<str:username>/reposts/", feed.user_reposts),
    path("users/<str:username>/liked-posts/", feed.user_liked_posts),
    path("users/<str:username>/commented-posts/", feed.user_commented_posts),

    # Сообщения
    path("messages/", messaging.messages),
    path("messages/conversations/", messaging.conversations),
    path("messages/<int:message_id>/reactions/", messaging.toggle_reaction),
    path("messages/<int:message_id>/forward/", messaging.forward_message),

    # Учёба
    path("academic/schedule/", academic.schedule_view),
]
