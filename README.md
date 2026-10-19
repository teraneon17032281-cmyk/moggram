# MogGram — соцсеть для студентов IUCA

Django (бэкенд, REST API) + React/Vite/TypeScript (фронтенд в папке `frontend/`).

```
.
├── manage.py, config/      настройки Django и маршруты (config/api_urls.py — весь API)
├── users/                  пользователи, подтверждение почты, профили, подписки, настройки
├── feed/                   публикации, лайки, репосты, комментарии
├── messaging/              личные сообщения (фото, голосовые, ответы, реакции, пересылка)
├── academic/               расписание (GET /api/academic/schedule/), админка предметов/мероприятий
├── core/                   общие помощники API + тесты (core/tests.py)
└── frontend/               React-приложение
```

## Быстрый старт (Windows PowerShell; на macOS/Linux — `source .venv/bin/activate`)

### 1. Бэкенд
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # по желанию отредактируйте
python manage.py migrate
python manage.py createsuperuser   # почта обязательно @iuca.kg
python manage.py runserver
```

**Вашу старую базу** (`db.sqlite3`) просто положите в корень проекта до `migrate`: миграции сохранят пользователей и посты, а всем существующим пользователям поставят `email_verified=True` (они раньше входили с кодом на почту).

### 2. Фронтенд — два варианта

**А. Разработка (два сервера, горячая перезагрузка)** — второй терминал:
```powershell
cd frontend
copy .env.example .env      # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev                 # http://localhost:5173
```
Открывайте именно `http://localhost:5173` и не смешивайте `localhost` с `127.0.0.1` — иначе браузер не отправит cookie.

**Б. Один сервер (Django сам отдаёт сайт)**:
```powershell
cd frontend
npm install
npm run build               # использует frontend/.env.production: API на том же адресе
cd ..
python manage.py runserver  # сайт и API: http://localhost:8000
```

## Письма с кодами

Пока `EMAIL_HOST_USER` в `.env` пустой, письма **печатаются в консоль**, где запущен `runserver` — код подтверждения берите оттуда. Для настоящей отправки через Gmail заполните в `.env`:
```
EMAIL_HOST_USER=ваш-адрес@gmail.com
EMAIL_HOST_PASSWORD=пароль-приложения-из-16-символов
DEFAULT_FROM_EMAIL=MogGram <ваш-адрес@gmail.com>
```
> **Безопасность.** В прежнем `settings.py` был записан пароль приложения Gmail, он остался в истории git и в загруженном архиве. Отзовите его в аккаунте Google (Безопасность → Пароли приложений) и создайте новый — только в `.env`.

## Как это работает

- Вход по **почте и паролю**; сессионная cookie Django + CSRF (`X-CSRFToken`).
- Регистрация → 6-значный код на почту (хранится только хеш, живёт 10 минут, 5 попыток, повтор не чаще раза в минуту) → после подтверждения сразу открывается лента.
- Пост можно опубликовать анонимно: в API автор не отдаётся, но в базе запись с автором связана. Анонимные посты не попадают в публичные списки пользователя (посты, репосты, лайки, комментарии).
- Статус «в сети» (heartbeat раз в 30 с, окно 90 с) видят только те, у кого есть подписка с этим человеком, и только если он не отключил его в настройках.
- Загрузки (фото постов ≤10 МБ, аватар ≤5 МБ, фото/голосовые в сообщениях) проверяются по содержимому, а не по расширению; файлам даются случайные имена.
- Сброс пароля: `POST /api/auth/password-reset/` → письмо со ссылкой на `/reset-password?uid=…&token=…` (страница добавлена во фронтенд).
- Старые серверные страницы Django (`/auth/login`, `/feed/`, 2FA-шаблоны) удалены: их заменяет React. Прежний код остаётся в истории git.
- Расписание: у фронтенда пока нет страницы, но API готово; факультет пользователю назначается в админке (`/admin/`).

## Тесты
```powershell
python manage.py test        # 40 тестов контракта API
```

## Для продакшена
`DJANGO_DEBUG=False`, свой `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `COOKIE_SECURE=True`, HTTPS. Файлы `/media/` и `/static/` (после `collectstatic`) должен раздавать веб-сервер (nginx и т. п.), а не `runserver`. Для нескольких процессов настройте общий кеш (Redis) — на нём работает ограничение частоты запросов.
