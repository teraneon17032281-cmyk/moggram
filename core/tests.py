"""Тесты контракта API (то, что ждёт React-фронтенд). Запуск: python manage.py test"""
import io
import json
import re
import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from PIL import Image

from academic.models import Schedule, Subject, Teacher
from feed.models import Post
from messaging.models import Message
from users.models import BlockedUser, EmailCode, Faculty, Follow, University, User

PASSWORD = "Str0ngPass!word"
MEDIA = tempfile.mkdtemp(prefix="moggram-test-media-")


def png_file(name="photo.png", size=(8, 8)):
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def audio_file(name="voice.webm"):
    return SimpleUploadedFile(name, b"\x1a\x45\xdf\xa3" + b"\x00" * 200, content_type="audio/webm")


def make_user(username, email=None, **extra):
    return User.objects.create_user(
        username=username, email=email or f"{username}@iuca.kg", password=PASSWORD,
        full_name=extra.pop("full_name", username.title()), email_verified=extra.pop("email_verified", True), **extra,
    )


class ApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = override_settings(MEDIA_ROOT=MEDIA)
        cls._media.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media.disable()
        shutil.rmtree(MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        cache.clear()
        mail.outbox = []

    # --- помощники ---
    def client_for(self, user=None):
        c = Client()
        if user:
            c.force_login(user)
        return c

    def post_json(self, client, url, data=None, **kw):
        return client.post(url, data=json.dumps(data or {}), content_type="application/json", **kw)

    def last_code(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


class AuthFlowTests(ApiTestCase):
    def register(self, client=None, **over):
        data = {"full_name": "Alex Morgan", "email": "alex@iuca.kg", "username": "alex.morgan", "password": PASSWORD}
        data.update(over)
        return self.post_json(client or Client(), "/api/auth/register/", data)

    def test_full_registration_flow_logs_user_in(self):
        c = Client()
        r = self.register(c)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json(), {"email": "alex@iuca.kg", "code_sent": True, "expires_in": 600, "resend_after": 60})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["alex@iuca.kg"])
        self.assertFalse(User.objects.get(username="alex.morgan").email_verified)

        # Код хранится только в виде хеша
        self.assertNotIn(self.last_code(), EmailCode.objects.get().code_hash)

        # До подтверждения войти нельзя
        r = self.post_json(Client(), "/api/auth/login/", {"email": "alex@iuca.kg", "password": PASSWORD, "remember": False})
        self.assertEqual((r.status_code, r.json()["code"]), (403, "email_not_verified"))

        r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": self.last_code()})
        self.assertEqual((r.status_code, r.json()), (200, {"verified": True}))

        me = c.get("/api/auth/me/")  # сессия создана при подтверждении
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["user"]["username"], "alex.morgan")
        self.assertEqual(me.json()["user"]["email"], "alex@iuca.kg")

        # Повторное подтверждение
        r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": "123456"})
        self.assertEqual((r.status_code, r.json()["code"]), (409, "already_verified"))

    def test_register_validation_errors(self):
        r = self.register(email="alex@gmail.com")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["code"], "validation_error")
        self.assertIn("email", r.json()["errors"])

        r = self.register(password="weak", username="a", full_name="A")
        errs = r.json()["errors"]
        self.assertTrue({"password", "username", "full_name"} <= set(errs))

        r = self.register(username="me")
        self.assertIn("username", r.json()["errors"])
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_duplicate_email_and_username(self):
        make_user("taken", email="taken@iuca.kg")
        self.assertIn("email", self.register(email="Taken@iuca.kg").json()["errors"])
        self.assertIn("username", self.register(username="TAKEN").json()["errors"])

    def test_reregistering_unverified_account_resends_code(self):
        self.assertEqual(self.register().status_code, 201)
        r = self.register(full_name="Alex M.", password="An0therStrong!pass")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.filter(email="alex@iuca.kg").count(), 1)
        self.assertEqual(len(mail.outbox), 2)

    def test_email_delivery_failure_returns_502(self):
        from unittest import mock
        with mock.patch("users.api_auth.services.send_code_email", side_effect=OSError("smtp down")):
            r = self.register()
        self.assertEqual((r.status_code, r.json()["code"]), (502, "email_delivery_failed"))
        self.assertTrue(User.objects.filter(email="alex@iuca.kg").exists())  # аккаунт создан
        # Повторно запросить код можно сразу (пауза не навязывается после сбоя)
        r = self.post_json(Client(), "/api/auth/resend-code/", {"email": "alex@iuca.kg"})
        self.assertEqual(r.status_code, 200)

    def test_wrong_code_expired_and_lockout(self):
        self.register()
        c = Client()
        r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": "000000" if self.last_code() != "000000" else "111111"})
        self.assertEqual((r.status_code, r.json()["code"]), (400, "invalid_code"))

        record = EmailCode.objects.get()
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save()
        r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": self.last_code()})
        self.assertEqual((r.status_code, r.json()["code"]), (400, "code_expired"))

        r = self.post_json(c, "/api/auth/verify-email/", {"email": "nobody@iuca.kg", "code": "123456"})
        self.assertEqual((r.status_code, r.json()["code"]), (404, "account_not_found"))

    def test_too_many_attempts_burns_code(self):
        self.register()
        real = self.last_code()
        wrong = "999999" if real != "999999" else "888888"
        c = Client()
        codes = []
        for _ in range(5):
            codes.append(self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": wrong}))
        self.assertEqual([r.status_code for r in codes], [400, 400, 400, 400, 429])
        self.assertEqual(codes[-1].json()["code"], "too_many_attempts")
        self.assertGreater(codes[-1].json()["retry_after"], 0)
        # Даже правильный код после блокировки не принимается
        r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": real})
        self.assertEqual(r.status_code, 429)
        self.assertFalse(User.objects.get(username="alex.morgan").email_verified)

    def test_resend_cooldown_then_new_code_replaces_old(self):
        self.register()
        old = self.last_code()
        c = Client()
        r = self.post_json(c, "/api/auth/resend-code/", {"email": "alex@iuca.kg"})
        self.assertEqual((r.status_code, r.json()["code"]), (429, "resend_too_soon"))
        self.assertTrue(0 < r.json()["retry_after"] <= 60)

        EmailCode.objects.update(sent_at=timezone.now() - timedelta(seconds=61))
        r = self.post_json(c, "/api/auth/resend-code/", {"email": "alex@iuca.kg"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["code_sent"])
        new = self.last_code()
        if new != old:
            r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": old})
            self.assertEqual(r.status_code, 400)
        r = self.post_json(c, "/api/auth/verify-email/", {"email": "alex@iuca.kg", "code": new})
        self.assertEqual(r.status_code, 200)

    def test_login_logout_me_and_remember(self):
        make_user("sam")
        c = Client()
        self.assertEqual(c.get("/api/auth/me/").status_code, 401)

        r = self.post_json(c, "/api/auth/login/", {"email": "sam@iuca.kg", "password": "wrong", "remember": False})
        self.assertEqual((r.status_code, r.json()["code"]), (401, "invalid_credentials"))
        r = self.post_json(c, "/api/auth/login/", {"email": "ghost@iuca.kg", "password": PASSWORD, "remember": False})
        self.assertEqual((r.status_code, r.json()["code"]), (401, "invalid_credentials"))

        r = self.post_json(c, "/api/auth/login/", {"email": "SAM@iuca.kg", "password": PASSWORD, "remember": True})
        self.assertEqual(r.status_code, 200)
        user = r.json()["user"]
        self.assertEqual(set(user), {"id", "full_name", "email", "username", "is_verified", "avatar_url", "followers_count", "following_count"})
        self.assertGreater(c.session.get_expiry_age(), 60 * 60 * 24 * 29)

        self.assertEqual(self.post_json(c, "/api/auth/logout/").status_code, 204)
        self.assertEqual(c.get("/api/auth/me/").status_code, 401)

        self.post_json(c, "/api/auth/login/", {"email": "sam@iuca.kg", "password": PASSWORD, "remember": False})
        self.assertTrue(c.session.get_expire_at_browser_close())

    def test_login_is_throttled(self):
        make_user("sam")
        for _ in range(10):
            self.post_json(Client(), "/api/auth/login/", {"email": "sam@iuca.kg", "password": "bad"})
        r = self.post_json(Client(), "/api/auth/login/", {"email": "sam@iuca.kg", "password": PASSWORD})
        self.assertEqual((r.status_code, r.json()["code"]), (429, "too_many_attempts"))

    def test_csrf_is_enforced_and_token_flow_works(self):
        make_user("sam")
        c = Client(enforce_csrf_checks=True)
        body = json.dumps({"email": "sam@iuca.kg", "password": PASSWORD, "remember": False})
        self.assertEqual(c.post("/api/auth/login/", body, content_type="application/json").status_code, 403)

        self.assertEqual(c.get("/api/auth/csrf/").status_code, 204)
        token = c.cookies["csrftoken"].value
        r = c.post("/api/auth/login/", body, content_type="application/json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code, 200)

    def test_password_reset_flow(self):
        user = make_user("sam")
        c = Client()
        # Неизвестный адрес — тот же ответ, письмо не уходит
        r = self.post_json(c, "/api/auth/password-reset/", {"email": "ghost@iuca.kg"})
        self.assertEqual((r.status_code, r.json()), (200, {"accepted": True}))
        self.assertEqual(len(mail.outbox), 0)

        r = self.post_json(c, "/api/auth/password-reset/", {"email": "sam@iuca.kg"})
        self.assertEqual(r.json(), {"accepted": True})
        link = re.search(r"reset-password\?uid=([^&\s]+)&token=([^\s]+)", mail.outbox[0].body)
        uid, token = link.groups()

        r = self.post_json(c, "/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "weak"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.json()["errors"])

        r = self.post_json(c, "/api/auth/password-reset/confirm/", {"uid": uid, "token": "bad-token", "password": "N3wStrong!pass"})
        self.assertEqual((r.status_code, r.json()["code"]), (400, "invalid_token"))

        r = self.post_json(c, "/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "N3wStrong!pass"})
        self.assertEqual(r.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("N3wStrong!pass"))
        # Ссылка одноразовая
        r = self.post_json(c, "/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "An0ther!Strong1"})
        self.assertEqual(r.status_code, 400)

    def test_legacy_user_without_full_clean_issues_can_login(self):
        """Старые аккаунты (до миграции) получают email_verified=True и входят как обычно."""
        u = make_user("legacy", email_verified=True)
        r = self.post_json(Client(), "/api/auth/login/", {"email": u.email, "password": PASSWORD, "remember": False})
        self.assertEqual(r.status_code, 200)


class FeedTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.alice, self.bob = make_user("alice"), make_user("bob")
        self.ca, self.cb = self.client_for(self.alice), self.client_for(self.bob)

    def create(self, client, content="Привет, университет!", **extra):
        return self.post_json(client, "/api/posts/", {"content": content, **extra})

    def test_requires_login(self):
        for url in ("/api/posts/", "/api/posts/mine/", "/api/users/me/reposts/", "/api/messages/conversations/"):
            self.assertEqual(Client().get(url).status_code, 401, url)

    def test_create_and_list_post_shape(self):
        r = self.create(self.ca)
        self.assertEqual(r.status_code, 201)
        post = r.json()
        self.assertEqual(set(post), {"id", "content", "is_anonymous", "created_at", "author", "like_count", "comment_count",
                                     "repost_count", "liked_by_me", "reposted_by_me", "image_url", "link_url"})
        self.assertEqual(post["author"]["username"], "alice")
        self.assertEqual(set(post["author"]), {"id", "full_name", "username", "is_verified", "avatar_url"})
        self.assertTrue(post["created_at"].endswith("Z"))

        feed = self.cb.get("/api/posts/").json()["results"]
        self.assertEqual([p["id"] for p in feed], [post["id"]])

    def test_post_validation(self):
        self.assertEqual(self.create(self.ca, content="   ").status_code, 400)
        self.assertEqual(self.create(self.ca, content="x" * 5001).status_code, 400)
        self.assertEqual(self.create(self.ca, link_url="javascript:alert(1)").status_code, 400)
        self.assertEqual(self.create(self.ca, link_url="https://iuca.kg").json()["link_url"], "https://iuca.kg")
        self.assertEqual(Post.objects.count(), 1)

    def test_anonymous_post_hides_author_everywhere_public(self):
        anon = self.create(self.ca, content="секрет", is_anonymous=True).json()
        self.assertTrue(anon["is_anonymous"])
        self.assertIsNone(anon["author"])
        self.assertEqual(Post.objects.get(pk=anon["id"]).author, self.alice)  # в базе автор сохранён

        feed = self.cb.get("/api/posts/").json()["results"][0]
        self.assertIsNone(feed["author"])
        self.assertNotIn("alice", json.dumps(feed).lower())
        # В публичных публикациях автора анонимного поста нет
        self.assertEqual(self.cb.get("/api/users/alice/posts/").json()["results"], [])
        # Но владелец видит его в «моих»
        mine = self.ca.get("/api/posts/mine/").json()["results"]
        self.assertEqual([(p["id"], p["is_anonymous"]) for p in mine], [(anon["id"], True)])
        self.assertEqual(self.cb.get("/api/posts/mine/").json()["results"], [])
        # Счётчик постов в публичном профиле не выдаёт анонимные
        self.assertEqual(self.cb.get("/api/users/alice/").json()["post_count"], 0)
        self.assertEqual(self.ca.get("/api/users/me/").json()["post_count"], 1)

    def test_multipart_post_with_photo(self):
        r = self.ca.post("/api/posts/", {"content": "с фото", "is_anonymous": "false", "attachment": png_file()})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertRegex(r.json()["image_url"], r"^http://testserver/media/posts_images/[0-9a-f]{32}\.png$")
        # Фото без текста тоже можно (фронтенд это разрешает)
        r = self.ca.post("/api/posts/", {"content": "", "attachment": png_file()})
        self.assertEqual(r.status_code, 201)

    def test_fake_image_is_rejected(self):
        fake = SimpleUploadedFile("evil.png", b"<script>alert(1)</script>", content_type="image/png")
        r = self.ca.post("/api/posts/", {"content": "x", "attachment": fake})
        self.assertEqual((r.status_code, r.json()["code"]), (400, "invalid_image"))
        big = SimpleUploadedFile("big.png", b"\x89PNG\r\n\x1a\n" + b"0" * (10 * 1024 * 1024 + 1), content_type="image/png")
        r = self.ca.post("/api/posts/", {"content": "x", "attachment": big})
        self.assertEqual((r.status_code, r.json()["code"]), (400, "file_too_large"))

    def test_like_toggle_and_counts(self):
        pid = self.create(self.ca).json()["id"]
        r = self.post_json(self.cb, f"/api/posts/{pid}/like/")
        self.assertEqual(r.json(), {"liked": True, "like_count": 1})
        self.assertTrue(self.cb.get("/api/posts/").json()["results"][0]["liked_by_me"])
        self.assertFalse(self.ca.get("/api/posts/").json()["results"][0]["liked_by_me"])
        r = self.post_json(self.cb, f"/api/posts/{pid}/like/")
        self.assertEqual(r.json(), {"liked": False, "like_count": 0})
        self.assertEqual(self.post_json(self.cb, "/api/posts/9999/like/").status_code, 404)

    def test_repost_toggle_is_unique_per_user(self):
        pid = self.create(self.ca).json()["id"]
        self.assertEqual(self.post_json(self.cb, f"/api/posts/{pid}/repost/").json(), {"reposted": True, "repost_count": 1})
        self.assertTrue(self.cb.get("/api/posts/").json()["results"][0]["reposted_by_me"])
        self.assertEqual(self.post_json(self.ca, f"/api/posts/{pid}/repost/").json()["repost_count"], 2)
        self.assertEqual(self.post_json(self.cb, f"/api/posts/{pid}/repost/").json(), {"reposted": False, "repost_count": 1})

    def test_comments(self):
        pid = self.create(self.ca).json()["id"]
        r = self.post_json(self.cb, f"/api/posts/{pid}/comments/", {"content": "Круто!"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(set(r.json()), {"id", "content", "created_at", "author"})
        self.assertEqual(r.json()["author"]["username"], "bob")
        self.assertEqual(self.post_json(self.cb, f"/api/posts/{pid}/comments/", {"content": " "}).status_code, 400)
        listing = self.ca.get(f"/api/posts/{pid}/comments/").json()["results"]
        self.assertEqual([c["content"] for c in listing], ["Круто!"])
        self.assertEqual(self.ca.get("/api/posts/").json()["results"][0]["comment_count"], 1)

    def test_public_activity_lists_respect_privacy_settings(self):
        pid = self.create(self.ca, content="пост Alice").json()["id"]
        own_anon = self.create(self.cb, content="анонимка Bob", is_anonymous=True).json()["id"]
        # Bob лайкает, репостит, комментирует пост Alice и свою анонимку
        for target in (pid, own_anon):
            self.post_json(self.cb, f"/api/posts/{target}/like/")
            self.post_json(self.cb, f"/api/posts/{target}/repost/")
            self.post_json(self.cb, f"/api/posts/{target}/comments/", {"content": f"к {target}"})

        # Настройки по умолчанию — всё скрыто
        for kind in ("reposts", "liked-posts", "commented-posts"):
            self.assertEqual(self.ca.get(f"/api/users/bob/{kind}/").json()["results"], [], kind)
            self.assertEqual(len(self.cb.get(f"/api/users/me/{kind}/").json()["results"]), 2, kind)

        r = self.post_json(self.cb, "/api/auth/preferences/", {
            "theme": "light", "language": "en", "show_online_status": True, "show_own_anonymous_posts": True,
            "show_own_reposts": True, "show_own_liked_posts": True, "show_own_commented_posts": True,
            "notifications": {"email_updates": False, "mentions_and_replies": True},
        })
        self.assertEqual(r.status_code, 200)
        prof = self.ca.get("/api/users/bob/").json()
        self.assertTrue(prof["show_reposts"] and prof["show_liked_posts"] and prof["show_commented_posts"])

        # Даже при включённом показе анонимка самого Bob в публичных списках не появляется
        for kind in ("reposts", "liked-posts"):
            ids = [p["id"] for p in self.ca.get(f"/api/users/bob/{kind}/").json()["results"]]
            self.assertEqual(ids, [pid], kind)
        items = self.ca.get("/api/users/bob/commented-posts/").json()["results"]
        self.assertEqual([i["post"]["id"] for i in items], [pid])
        self.assertEqual(set(items[0]), {"post", "comment"})
        self.assertEqual(items[0]["comment"]["author"]["username"], "bob")

        self.bob.refresh_from_db()
        self.assertEqual((self.bob.theme, self.bob.language, self.bob.notify_email_updates), ("light", "en", False))

    def test_preferences_validation(self):
        self.assertEqual(self.post_json(self.ca, "/api/auth/preferences/", {"theme": "neon"}).status_code, 400)
        self.assertEqual(self.post_json(self.ca, "/api/auth/preferences/", {"language": "xx"}).status_code, 400)


class UsersTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.alice = make_user("alice", full_name="Алиса Иванова")
        self.bob = make_user("bob", full_name="Bob Marley")
        self.ca, self.cb = self.client_for(self.alice), self.client_for(self.bob)

    def test_search_is_case_insensitive_for_cyrillic_and_skips_self_and_unverified(self):
        make_user("ghost", full_name="Алина Призрак", email_verified=False)
        r = self.cb.get("/api/users/", {"search": "АЛИ"}).json()["results"]
        self.assertEqual([u["username"] for u in r], ["alice"])
        user = r[0]
        for key in ("id", "full_name", "username", "avatar_url", "is_verified", "bio", "post_count",
                    "followers_count", "following_count", "is_following"):
            self.assertIn(key, user)
        self.assertEqual(self.cb.get("/api/users/", {"search": "@bo"}).json()["results"], [])  # себя не находим
        self.assertEqual(self.cb.get("/api/users/", {"search": ""}).json()["results"], [])

    def test_follow_toggle_and_counts(self):
        r = self.post_json(self.cb, "/api/users/alice/follow/")
        self.assertEqual(r.json(), {"following": True, "followers_count": 1})
        prof = self.cb.get("/api/users/alice/").json()
        self.assertTrue(prof["is_following"])
        self.assertEqual(self.ca.get("/api/auth/me/").json()["user"]["followers_count"], 1)
        self.assertEqual(self.post_json(self.cb, "/api/users/alice/follow/").json(), {"following": False, "followers_count": 0})
        self.assertEqual(self.post_json(self.ca, "/api/users/alice/follow/").status_code, 400)
        self.assertEqual(self.post_json(self.ca, "/api/users/nobody/follow/").status_code, 404)

    def test_online_status_only_for_related_viewers_and_respects_setting(self):
        self.assertEqual(self.post_json(self.ca, "/api/auth/presence/", {"visible": True}).status_code, 204)
        self.assertNotIn("is_online", self.cb.get("/api/users/alice/").json())  # чужой — не видит

        Follow.objects.create(follower=self.bob, following=self.alice)
        self.assertTrue(self.cb.get("/api/users/alice/").json()["is_online"])
        self.assertTrue(self.cb.get("/api/users/", {"search": "alice"}).json()["results"][0]["is_online"])

        self.alice.refresh_from_db()
        User.objects.filter(pk=self.alice.pk).update(last_seen_at=timezone.now() - timedelta(seconds=120))
        self.assertFalse(self.cb.get("/api/users/alice/").json()["is_online"])  # heartbeat старше 90 секунд

        self.post_json(self.ca, "/api/auth/presence/", {"visible": True})
        self.assertTrue(self.cb.get("/api/users/alice/").json()["is_online"])
        self.post_json(self.ca, "/api/auth/presence/", {"visible": False})
        self.assertFalse(self.cb.get("/api/users/alice/").json()["is_online"])

        self.post_json(self.ca, "/api/auth/preferences/", {"show_online_status": False})
        self.post_json(self.ca, "/api/auth/presence/", {"visible": True})
        self.assertFalse(self.cb.get("/api/users/alice/").json()["is_online"])

    def test_update_profile_with_avatar(self):
        r = self.ca.post("/api/users/me/", {"full_name": "Алиса Петрова", "username": "alice_p", "bio": "Студентка IUCA", "avatar": png_file("me.png")})
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual((body["full_name"], body["username"], body["bio"]), ("Алиса Петрова", "alice_p", "Студентка IUCA"))
        self.assertRegex(body["avatar_url"], r"^http://testserver/media/avatars/[0-9a-f]{32}\.png$")
        self.assertEqual(self.ca.get("/api/auth/me/").json()["user"]["username"], "alice_p")
        self.assertEqual(self.cb.get("/api/users/alice_p/").status_code, 200)

    def test_update_profile_validation(self):
        r = self.ca.post("/api/users/me/", {"full_name": "A", "username": "bob", "bio": "x" * 501})
        self.assertEqual(r.status_code, 400)
        self.assertTrue({"full_name", "username", "bio"} <= set(r.json()["errors"]))
        r = self.ca.post("/api/users/me/", {"full_name": "Алиса", "username": "me", "bio": ""})
        self.assertIn("username", r.json()["errors"])
        r = self.ca.post("/api/users/me/", {"full_name": "Алиса", "username": "alice", "bio": "", "avatar": png_file(size=(2, 2))})
        self.assertEqual(r.status_code, 200)

    def test_blocked_users_are_hidden(self):
        BlockedUser.objects.create(user=self.alice, blocked_user=self.bob)
        self.assertEqual(self.cb.get("/api/users/", {"search": "alice"}).json()["results"], [])
        self.assertEqual(self.cb.get("/api/users/alice/").status_code, 404)
        self.assertEqual(self.post_json(self.cb, "/api/users/alice/follow/").status_code, 403)

    def test_academic_schedule(self):
        self.assertEqual(self.ca.get("/api/academic/schedule/").json()["code"], "faculty_required")
        uni = University.objects.first() or University.objects.create()
        faculty = Faculty.objects.create(university=uni, name="IT")
        self.alice.faculty = faculty
        self.alice.save()
        teacher_user = make_user("prof", role="teacher")
        Schedule.objects.create(
            faculty=faculty, subject=Subject.objects.create(name="Algorithms", code="CS101"),
            teacher=Teacher.objects.create(user=teacher_user, department="CS"),
            weekday=1, start_time="09:00", end_time="10:20", room="101", course=1,
        )
        data = self.ca.get("/api/academic/schedule/").json()
        self.assertEqual(data["faculty"], "IT")
        self.assertEqual(data["days"][0]["lessons"][0]["subject"], "Algorithms")


class MessagingTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.alice, self.bob, self.eve = make_user("alice"), make_user("bob"), make_user("eve")
        self.ca, self.cb, self.ce = (self.client_for(u) for u in (self.alice, self.bob, self.eve))

    def send(self, client, to, content="Привет!", **extra):
        return self.post_json(client, "/api/messages/", {"recipient_username": to, "content": content, **extra})

    def test_send_and_read_conversation(self):
        r = self.send(self.ca, "bob")
        self.assertEqual(r.status_code, 201)
        msg = r.json()
        self.assertEqual(set(msg), {"id", "content", "created_at", "sender_id", "sender_name", "sender_username",
                                    "recipient_username", "attachment_url", "attachment_type", "attachment_name",
                                    "reply_to", "reactions"})
        self.assertEqual((msg["sender_username"], msg["recipient_username"], msg["reply_to"], msg["reactions"]), ("alice", "bob", None, []))

        self.send(self.cb, "alice", "Привет, Alice")
        history = self.ca.get("/api/messages/", {"with": "bob"}).json()["results"]
        self.assertEqual([m["content"] for m in history], ["Привет!", "Привет, Alice"])
        self.assertEqual(self.ce.get("/api/messages/", {"with": "bob"}).json()["results"], [])  # чужая переписка пуста

    def test_validation(self):
        self.assertEqual(self.send(self.ca, "alice").status_code, 400)       # самому себе
        self.assertEqual(self.send(self.ca, "nobody").status_code, 404)
        self.assertEqual(self.send(self.ca, "bob", "  ").status_code, 400)
        self.assertEqual(self.send(self.ca, "bob", "x" * 4001).status_code, 400)
        BlockedUser.objects.create(user=self.bob, blocked_user=self.alice)
        r = self.send(self.ca, "bob")  # Bob заблокировал Alice
        self.assertEqual((r.status_code, r.json()["code"]), (403, "blocked"))

    def test_conversations_list_one_row_per_partner_newest_first(self):
        self.send(self.ca, "bob", "первое")
        self.send(self.ce, "alice", "от Eve")
        self.send(self.cb, "alice", "последнее от Bob")
        rows = self.ca.get("/api/messages/conversations/").json()["results"]
        self.assertEqual([r["username"] for r in rows], ["bob", "eve"])
        self.assertEqual(rows[0]["last_message"]["content"], "последнее от Bob")
        self.assertEqual({"username", "full_name", "avatar_url", "last_message"} - set(rows[0]), set())
        self.assertNotIn("is_online", rows[0])  # подписки нет — статус не раскрываем
        Follow.objects.create(follower=self.alice, following=self.bob)
        self.assertIn("is_online", self.ca.get("/api/messages/conversations/").json()["results"][0])

    def test_reply_to_must_belong_to_same_conversation(self):
        first = self.send(self.ca, "bob", "вопрос").json()
        reply = self.send(self.cb, "alice", "ответ", reply_to_id=first["id"]).json()
        self.assertEqual(reply["reply_to"], {"id": first["id"], "content": "вопрос", "sender_name": "Alice"})
        other = self.send(self.ce, "bob", "чужое").json()
        r = self.send(self.cb, "alice", "хак", reply_to_id=other["id"])
        self.assertEqual(r.status_code, 400)

    def test_attachments(self):
        r = self.ca.post("/api/messages/", {"recipient_username": "bob", "content": "", "attachment": png_file("cat.png")})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.json()["attachment_type"], r.json()["attachment_name"]), ("image", "cat.png"))
        self.assertRegex(r.json()["attachment_url"], r"/media/messages/[0-9a-f]{32}\.png$")

        r = self.ca.post("/api/messages/", {"recipient_username": "bob", "content": "", "attachment": audio_file()})
        self.assertEqual((r.status_code, r.json()["attachment_type"]), (201, "audio"), r.content)
        self.assertRegex(r.json()["attachment_url"], r"\.webm$")

        bad = SimpleUploadedFile("run.exe", b"MZ\x90\x00" + b"0" * 50, content_type="audio/webm")
        r = self.ca.post("/api/messages/", {"recipient_username": "bob", "content": "", "attachment": bad})
        self.assertEqual(r.status_code, 400)
        r = self.ca.post("/api/messages/", {"recipient_username": "bob", "content": "", "attachment": SimpleUploadedFile("v.webm", b"\x1a\x45\xdf\xa3" + b"0" * (4 * 1024 * 1024))})
        self.assertEqual((r.status_code, r.json()["code"]), (400, "file_too_large"))

    def test_reactions_toggle_and_access_control(self):
        mid = self.send(self.ca, "bob").json()["id"]
        r = self.post_json(self.cb, f"/api/messages/{mid}/reactions/", {"emoji": "❤️"})
        self.assertEqual(r.json(), {"reactions": [{"emoji": "❤️", "count": 1, "reacted_by_me": True}]})
        r = self.post_json(self.ca, f"/api/messages/{mid}/reactions/", {"emoji": "❤️"})
        self.assertEqual(r.json()["reactions"], [{"emoji": "❤️", "count": 2, "reacted_by_me": True}])
        self.post_json(self.ca, f"/api/messages/{mid}/reactions/", {"emoji": "👍"})
        # В переписке видно актуальные агрегаты с точки зрения зрителя
        row = self.cb.get("/api/messages/", {"with": "alice"}).json()["results"][0]
        self.assertEqual(row["reactions"], [{"emoji": "❤️", "count": 2, "reacted_by_me": True}, {"emoji": "👍", "count": 1, "reacted_by_me": False}])
        # Повторное нажатие снимает
        r = self.post_json(self.cb, f"/api/messages/{mid}/reactions/", {"emoji": "❤️"})
        self.assertEqual(r.json()["reactions"][0], {"emoji": "❤️", "count": 1, "reacted_by_me": False})
        # Посторонний не может реагировать и не узнаёт о существовании сообщения
        self.assertEqual(self.post_json(self.ce, f"/api/messages/{mid}/reactions/", {"emoji": "😂"}).status_code, 404)
        self.assertEqual(self.post_json(self.cb, f"/api/messages/{mid}/reactions/", {"emoji": "abc"}).status_code, 400)
        self.assertEqual(self.post_json(self.cb, f"/api/messages/{mid}/reactions/", {"emoji": ""}).status_code, 400)

    def test_forward_copies_text_and_attachment(self):
        mid = self.ca.post("/api/messages/", {"recipient_username": "bob", "content": "смотри", "attachment": png_file("pic.png")}).json()["id"]
        r = self.post_json(self.cb, f"/api/messages/{mid}/forward/", {"recipient_username": "eve"})
        self.assertEqual(r.status_code, 201, r.content)
        fwd = r.json()
        self.assertEqual((fwd["sender_username"], fwd["recipient_username"], fwd["content"]), ("bob", "eve", "смотри"))
        self.assertEqual((fwd["attachment_type"], fwd["attachment_name"]), ("image", "pic.png"))
        original = Message.objects.get(pk=mid)
        copy = Message.objects.get(pk=fwd["id"])
        self.assertNotEqual(original.attachment.name, copy.attachment.name)  # файл скопирован, а не переиспользован
        self.assertEqual(original.attachment.read(), copy.attachment.read())
        # Eve видит пересланное, а пересылать чужие сообщения нельзя
        self.assertEqual(len(self.ce.get("/api/messages/", {"with": "bob"}).json()["results"]), 1)
        self.assertEqual(self.post_json(self.ce, f"/api/messages/{mid}/forward/", {"recipient_username": "alice"}).status_code, 404)


@override_settings(FRONTEND_DIST=None)
class SpaServingTests(TestCase):
    def test_unknown_api_route_is_json_404(self):
        r = Client().get("/api/nope/")
        self.assertEqual((r.status_code, r["Content-Type"]), (404, "application/json"))
        self.assertEqual(r.json()["code"], "not_found")

    def test_spa_fallback_serves_index_and_assets(self):
        from pathlib import Path
        dist = Path(tempfile.mkdtemp())
        (dist / "assets").mkdir()
        (dist / "index.html").write_text("<div id=root></div>")
        (dist / "assets" / "app.js").write_text("console.log(1)")
        with override_settings(FRONTEND_DIST=dist):
            c = Client()
            for url in ("/", "/login", "/users/alice", "/messages"):
                r = c.get(url)
                self.assertEqual(r.status_code, 200, url)
                self.assertIn(b"id=root", b"".join(r.streaming_content), url)
            self.assertIn(b"console.log", b"".join(c.get("/assets/app.js").streaming_content))
            traversal = c.get("/../../etc/passwd")  # выйти за пределы dist нельзя
            self.assertNotIn(b"root:", b"".join(getattr(traversal, "streaming_content", [traversal.content])))
            self.assertEqual(c.get("/admin/login/").status_code, 200)
        shutil.rmtree(dist, ignore_errors=True)
