#!/usr/bin/env bash
set -euo pipefail

# Apply pending Django schema changes before serving traffic. In particular,
# this creates the activity-notification table on existing Azure databases.
python manage.py migrate --noinput

exec gunicorn --bind=0.0.0.0 --timeout 600 config.wsgi:application
