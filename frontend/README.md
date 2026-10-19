# MogGram — frontend социальной сети

React 18 + Vite + TypeScript + Tailwind 3 + React Router 6 + React Hook Form + Zod.
Frontend работает с Django API. Бэкенд на Django лежит в корне репозитория (на уровень выше этой папки) и уже реализует описанный ниже контракт; инструкция по запуску — в корневом `README.md`. Письма из браузера не отправляются, а код подтверждения нигде не создаётся и не хранится на фронтенде.

## Запуск frontend (macOS)

Нужен Node.js 18+.

```bash
cd ~/Desktop/frontend11
cp .env.example .env      # при необходимости измените адрес API
npm install
npm run dev
```

Откройте адрес из терминала (обычно http://localhost:5173). `npm run build` проверяет типы и собирает production-версию в `dist/`.

После входа открывается общая лента. После регистрации пользователь подтверждает почту; чтобы сразу попасть в ленту, Django должен создать сессию при успешном подтверждении. Если сервер не создаёт сессию, интерфейс предложит войти. Публикации, профиль, сообщения и настройки загружаются из Django API. Демо-ленты и тестовых публикаций в этой сборке нет: если API недоступен, интерфейс показывает ошибку подключения.

## Переменные окружения

| Переменная | Пример | Описание |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Адрес Django API без завершающего `/`. По умолчанию `http://localhost:8000`. |

Значения `VITE_*` попадают в публичный бандл. Секреты (пароли почты и т. п.) хранятся только на бэкенде.

## Контракт API

Все запросы и ответы в JSON, `credentials: 'include'` (сессионная cookie Django), для POST отправляется заголовок `X-CSRFToken` из cookie `csrftoken`.

### Формат ошибок

```json
{ "code": "invalid_code", "message": "необязательный текст", "errors": { "email": ["Эта почта уже занята."] }, "retry_after": 42 }
```

`code` — машинный код (фронтенд показывает по нему понятное сообщение), `errors` — ошибки по полям (ключи `full_name`, `email`, `username`, `password`), `retry_after` — секунды до следующей попытки (необязательно).

### Подтверждение почты кодом

**`POST /api/auth/register/`** — принимать только адреса домена `@iuca.kg`; такую же проверку обязательно повторить в Django, потому что браузерная проверка не защищает API.
```json
{ "full_name": "Alex Morgan", "email": "alex@iuca.kg", "username": "alex.morgan", "password": "..." }
```
Сервер создаёт **неподтверждённый** аккаунт и отправляет 6-значный код на почту.
- `201` — `{ "email": "alex@iuca.kg", "code_sent": true, "expires_in": 600, "resend_after": 60 }`
  Фронтенд считает код отправленным **только если** `code_sent === true`.
- `400` — `{ "code": "validation_error", "errors": { "email": ["..."], "username": ["..."] } }` (в т. ч. дубликаты email/username)
- `502` — `{ "code": "email_delivery_failed" }`: аккаунт создан, но письмо не ушло. Фронтенд откроет экран кода с предложением запросить код повторно и не напишет, что код отправлен.

**`POST /api/auth/verify-email/`**
```json
{ "email": "alex@iuca.kg", "code": "123456" }
```
- `200` — `{ "verified": true }`
- `400` — `{ "code": "invalid_code" }` или `{ "code": "code_expired" }`
- `404` — `{ "code": "account_not_found" }`
- `409` — `{ "code": "already_verified" }`
- `429` — `{ "code": "too_many_attempts", "retry_after": 300 }`

**`POST /api/auth/resend-code/`**
```json
{ "email": "alex@iuca.kg" }
```
- `200` — как у регистрации: `{ "email", "code_sent": true, "expires_in", "resend_after" }`
- `429` — `{ "code": "resend_too_soon", "retry_after": 42 }` (фронтенд запускает таймер на это число секунд)
- `502` — `{ "code": "email_delivery_failed" }`

### Дополнительные эндпоинты (нужны, чтобы работали вход и защищённые страницы)

| Метод и путь | Назначение |
|---|---|
| `GET /api/auth/csrf/` | `204`, выставляет cookie `csrftoken` (`ensure_csrf_cookie`) |
| `POST /api/auth/login/` | `{ "email", "password", "remember" }` → `200 { "user": {...} }`; `401 invalid_credentials`; `403 email_not_verified` (фронтенд ведёт на экран ввода кода) |
| `GET /api/auth/me/` | `200 { "user": {...} }` или `401` — восстановление сессии после обновления страницы |
| `POST /api/auth/logout/` | `204` |
| `POST /api/auth/password-reset/` | `{ "email" }` → `200 { "accepted": true }`. Всегда `200` для существующих и несуществующих адресов. |

Объект `user`: `{ "id": 1, "full_name": "...", "email": "...", "username": "...", "followers_count": 12, "following_count": 8 }`. Счётчики подписок необязательны для авторизации, но возвращаются для профиля.

### Лента и публикации

Все маршруты ниже требуют действующую сессию Django. Лента возвращает новые публикации первыми. Список можно вернуть обычным массивом или стандартным ответом пагинации DRF (`{ "results": [...] }`).

**`GET /api/posts/`** — общая лента:
```json
{
  "results": [
    {
      "id": 42,
      "content": "Привет, университет!",
      "is_anonymous": false,
      "created_at": "2026-10-16T12:30:00Z",
      "author": { "id": 7, "full_name": "Alex Morgan", "username": "alex.morgan", "is_verified": false, "avatar_url": "https://api.example.test/media/avatars/alex.jpg" },
      "like_count": 12,
      "comment_count": 3,
      "repost_count": 1,
      "liked_by_me": false,
      "image_url": null
    }
  ]
}
```

Для анонимной публикации верните `is_anonymous: true` и `author: null`. Не включайте автора или другие данные, по которым его можно определить, в публичный ответ.

### Лайки, комментарии и репосты

Счётчики `like_count`, `comment_count`, `repost_count`, `liked_by_me` и `reposted_by_me` возвращаются в каждом посте; `avatar_url` возвращается в объекте автора, `image_url` — при наличии прикреплённой фотографии.

| Метод и адрес | Ожидаемый ответ |
|---|---|
| `POST /api/posts/{id}/like/` | `{ "liked": true, "like_count": 13 }`; повторный запрос снимает лайк |
| `POST /api/posts/{id}/repost/` | переключить репост текущего пользователя и ответить `{ "reposted": true, "repost_count": 2 }`; повторный запрос снимает его и возвращает `{ "reposted": false, "repost_count": 1 }` |
| `GET /api/posts/{id}/comments/` | `{ "results": [{ "id", "content", "created_at", "author": { "id", "full_name", "username", "avatar_url" } }] }` |
| `POST /api/posts/{id}/comments/` | запрос `{ "content": "Комментарий" }`; ответ — созданный комментарий в формате списка |
| `GET /api/users/me/commented-posts/` | история комментариев текущего пользователя: `{ "results": [{ "post": <публикация>, "comment": <комментарий> }] }` |
| `GET /api/users/{username}/commented-posts/` | такая же история для публичного профиля, только если владелец включил её показ |

Лайки и репосты привязаны к вошедшему пользователю. На паре (пользователь, публикация) должна стоять уникальность в базе данных; endpoint репоста переключает состояние, поэтому повторное нажатие отменяет репост. В каждой записи ленты верните `reposted_by_me`, чтобы интерфейс показывал актуальное состояние после перезагрузки. Анонимность поста не должна скрывать автора комментария или автора поста от самого Django.

**`POST /api/posts/`** — создать публикацию (ссылка необязательна):
```json
{ "content": "Текст публикации", "is_anonymous": true, "link_url": "https://iuca.kg" }
```
Ответ `201` — созданная публикация в том же формате, что и элемент ленты, с полем `link_url`. Django должен получить автора из текущей сессии, проверять непустой текст и ограничить длину до 5000 символов. Анонимность влияет на публичное отображение, но публикация всё равно должна быть связана с автором внутри базы данных.

Если к публикации прикреплено фото, фронтенд отправляет `multipart/form-data` с полями `content`, `is_anonymous`, необязательным `link_url` и файлом `attachment`. Django должен проверить MIME-тип и размер (до 10 МБ), сохранить файл в медиахранилище и вернуть его URL в `image_url`. Без поддержки этого multipart-варианта на backend публикация с фото не загрузится; публикации без фото продолжают отправляться JSON-запросом.

**`GET /api/posts/mine/`** — мои публикации, включая опубликованные анонимно. Этот адрес должен возвращать публикации только текущего вошедшего пользователя. На своей странице пользователь видит, какие из его публикаций были анонимными.

Для этих адресов возвращайте `401` без авторизации. Фронтенд отправляет сессионные cookies и CSRF-токен тем же способом, что и для авторизации.

### Поиск людей, профили и подписки

Публикации и анонимность не участвуют в поиске. Поиск отправляет имя или username:

| Метод и адрес | Ожидаемый ответ |
|---|---|
| `GET /api/users/?search=ali` | `{ "results": [{ "id", "full_name", "username", "avatar_url", "is_verified", "bio", "post_count", "followers_count", "following_count", "is_following", "is_online" }] }` (`is_online` optional; only for allowed viewers) |
| `GET /api/users/{username}/` | профиль в том же формате |
| `GET /api/users/{username}/posts/` | только публичные публикации этого пользователя; анонимные публикации скрываются |
| `GET /api/users/me/reposts/` и `GET /api/users/me/liked-posts/` | списки репостов и понравившихся публикаций текущего пользователя |
| `GET /api/users/{username}/reposts/` и `/liked-posts/` | публичные списки только если соответствующие настройки владельца включены; иначе отвечать `403` или пустым списком |
| `POST /api/users/{username}/follow/` | переключает подписку и отвечает `{ "following": true, "followers_count": 18 }` |

`GET /api/posts/mine/` остаётся отдельным адресом для страницы своего профиля и возвращает только посты текущего пользователя, в том числе анонимные. Проверять владельца нужно в Django по сессии, а не по переданному браузером id.

### Личные сообщения

| Метод и адрес | Ожидаемый ответ |
|---|---|
| `GET /api/messages/conversations/` | `{ "results": [{ "username", "full_name", "avatar_url", "is_online", "last_message": { "id", "content", "created_at", "sender_id", "sender_name", "sender_username", "recipient_username", "attachment_url", "attachment_type", "attachment_name", "reply_to", "reactions" } }] }` — по одной записи на собеседника, от новых переписок к старым |
| `GET /api/messages/?with=username` | `{ "results": [{ "id", "content", "created_at", "sender_id", "sender_name", "sender_username", "recipient_username", "attachment_url", "attachment_type", "attachment_name", "reply_to", "reactions" }] }` |
| `POST /api/messages/` | Текст отправляется JSON `{ "recipient_username": "username", "content": "Привет!", "reply_to_id": 42 }`. `reply_to_id` необязателен. Вложение отправляется `multipart/form-data`: поля `recipient_username`, `content`, необязательный `reply_to_id` и `attachment` (фото или голосовая запись). Ответ — созданное сообщение со ссылкой и типом вложения |
| `POST /api/messages/{id}/reactions/` | JSON `{ "emoji": "❤️" }` переключает реакцию текущего пользователя. Ответ `{ "reactions": [{ "emoji": "❤️", "count": 3, "reacted_by_me": true }] }`; сервер возвращает актуальные реакции сообщения |
| `POST /api/messages/{id}/forward/` | JSON `{ "recipient_username": "username" }` создаёт пересланное сообщение в выбранной переписке и возвращает его в обычном формате сообщения |

`reply_to` в сообщении — `null` или объект `{ "id", "content", "sender_name" }`. `reactions` — массив агрегатов `{ "emoji", "count", "reacted_by_me" }`. Реакции должны быть привязаны к пользователю и сообщению; повторное нажатие того же эмодзи снимает реакцию. Все новые endpoints должны требовать сессию, проверять участие пользователя в исходной переписке и не позволять пересылать/реагировать на сообщения, к которым у него нет доступа.

На телефоне экран сообщений сначала показывает список переписок: имя собеседника и последнее сообщение. Переписка загружается только после нажатия на строку и открывается как полноэкранный экран с закреплённым полем ввода; последнее сообщение показывается автоматически. Для этого `last_message` должен содержать те же поля, что и сообщение из `GET /api/messages/?with=username`.

Оба адреса доступны только вошедшим пользователям. Django проверяет, что получатель существует, и отдаёт переписку только её участникам.

Для загрузок Django должен проверять фактический MIME-тип, размер и допустимые форматы: фото — не больше 10 МБ, аватар — не больше 5 МБ, голосовые — максимум 2 минуты и серверный лимит размера. Для медиа-сообщения ответ включает `attachment_type: "image"` или `"audio"`. Хранить медиа следует в MEDIA storage и возвращать доступный `attachment_url`; пользовательские файлы нельзя считать безопасными только по расширению. При пересылке вложений сервер должен безопасно повторно связать существующий файл либо скопировать его в MEDIA storage и вернуть рабочий `attachment_url`.

### Редактирование профиля

| Метод и адрес | Назначение |
|---|---|
| `GET /api/users/me/` | вернуть профиль текущего пользователя: `id`, `full_name`, `username`, `avatar_url`, `bio`, счётчики и статус |
| `POST /api/users/me/` | обновить профиль. Фронтенд отправляет `multipart/form-data` с `full_name`, `username`, `bio` и необязательным `avatar` |

Django должен брать владельца только из сессии, проверять уникальность ника и ограничивать длину полей; аватар хранить в MEDIA storage. После успешного изменения фронтенд обновляет текущую сессию через `/api/auth/me/`.

### Настройки пользователя

**`POST /api/auth/preferences/`** — сохранить выбранные язык, тему и настройки приватности:
```json
{
  "theme": "dark",
  "language": "ru",
  "show_online_status": true,
  "show_own_anonymous_posts": false,
  "show_own_reposts": false,
  "show_own_liked_posts": false,
  "show_own_commented_posts": false,
  "notifications": { "email_updates": true, "mentions_and_replies": true }
}
```
Ответ `200` или `204`. Пока аккаунтные настройки сохраняются в браузере; после появления этого адреса выбор также синхронизируется с Django. При недоступности API интерфейс сообщит, что настройки сохранены только на устройстве.

Показ собственных анонимных публикаций, репостов, понравившихся записей и комментариев в профиле отключён по умолчанию. Настройки `show_own_reposts`, `show_own_liked_posts` и `show_own_commented_posts` управляются в разделе приватности. Django должен возвращать в профиле поля `show_reposts`, `show_liked_posts` и `show_commented_posts`, а также применять их на публичных endpoint-ах — скрытия вкладки только на клиенте недостаточно. Личные endpoint-ы `/api/users/me/...` доступны только владельцу. Публичный endpoint истории комментариев должен отдавать пустой/запрещённый ответ, если владелец выключил показ комментариев. Даже при включённом показе анонимные публикации не должны раскрывать автора другим людям.

Для истории комментариев каждый элемент содержит полную публикацию в формате ленты и комментарий `{ "id", "content", "created_at", "author" }`. Возвращайте только комментарии этого пользователя. Владелец видит свою историю через `/api/users/me/commented-posts/`; публичная версия подчиняется настройке `show_own_commented_posts`.

**`POST /api/auth/presence/`** — фронтенд отправляет `{ "visible": true }` раз в 30 секунд, пока пользователь авторизован и вкладка MogGram открыта. При скрытой вкладке или выключенном статусе отправляется `{ "visible": false }`. Django должен хранить время последнего heartbeat и показывать «в сети» только если отметка была не старше 90 секунд и `show_online_status` включён. Поле `is_online` в поиске и публичном профиле возвращайте только тем, кому разрешён просмотр статуса (например, друзьям/подписчикам); для остальных опускайте поле или возвращайте `null`. Не полагайтесь на состояние браузера как на контроль доступа.

### Переход после регистрации

После `POST /api/auth/verify-email/` фронтенд запрашивает `GET /api/auth/me/`. Чтобы пользователь сразу попал в ленту, при успешном подтверждении Django должен вызвать `login(request, user)` и вернуть `{ "verified": true }`; следующий запрос `/api/auth/me/` тогда вернёт объект пользователя. Если автоматический вход отключён, фронтенд оставит понятный шаг входа.

Сброс пароля: письмо ведёт на `/reset-password?uid=…&token=…`; страница отправляет `POST /api/auth/password-reset/confirm/` с `{ uid, token, password }` → `200 { "reset": true }`.

## Что настроить в Django для реальной отправки писем

1. **SMTP через переменные окружения**, без секретов в коде и в git:
   `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`.
   Бэкенд `console.EmailBackend` только печатает письмо в консоль и ничего не отправляет.
2. **Домен отправителя**: SPF, DKIM и DMARC, иначе письма попадут в спам или будут отклонены.
3. **Код**: генерировать через `secrets.randbelow(10**6)` с ведущими нулями, хранить только хеш, срок жизни (например 10 минут), одноразовый, лимит неверных попыток (например 5), пауза между отправками (например 60 с). Не писать код в логи на проде.
4. **Ошибки отправки**: если `send_mail` упал, отвечать `502 email_delivery_failed`, а не `201`.
5. **CORS и CSRF** (если фронтенд и API на разных адресах): `django-cors-headers` с `CORS_ALLOWED_ORIGINS=["http://localhost:5173"]` и `CORS_ALLOW_CREDENTIALS=True`; `CSRF_TRUSTED_ORIGINS=["http://localhost:5173"]`; на проде `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`. Чтение cookie `csrftoken` из JS работает, пока фронтенд и API на одном домене (допустимы разные порты и поддомены при общей cookie-области); иначе проще проксировать API через общий домен.
6. **`remember`** при входе: `request.session.set_expiry(...)` на 30 дней, иначе сессия до закрытия браузера (`0`).
7. Рекомендуется throttling на `register`, `resend-code`, `verify-email`, `login`.

## Структура

```
src/
  services/    apiClient.ts (fetch, ошибки, CSRF), authService.ts, feedService.ts,
               preferencesService.ts,
               pendingVerification.ts (email и время повторной отправки в sessionStorage; код не хранится)
  pages/       Login, Register, VerifyEmail, Feed, Search, Messages, Profile, Settings, ForgotPassword, Legal
  components/  ui/, auth/ и feed/ (публикации и форма создания поста)
  contexts/    AuthContext (сессия Django), PreferencesContext (тема и язык интерфейса)
  schemas/     Zod-схемы
```

Интерфейс поддерживает русский и английский; тексты ошибок API собраны в `src/services/apiClient.ts`.
