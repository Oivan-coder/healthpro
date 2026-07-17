# Project Structure v5.3

## Актуальная структура

```text
frontend/                # актуальный frontend MVP
backend/                 # актуальный Express backend API
backend/src/             # runtime backend source code
backend/import/          # словарь и служебные import-файлы
backend/storage/         # demo documents storage
_docs_unused/            # не используется (если появится в будущем)
_archive_unused/         # архив подтверждено неиспользуемых файлов
  assets_root_legacy_static/
  import_debug/
docs/                    # актуальная документация проекта
run-health-id.command    # основной запуск MVP
README.md                # основная инструкция
```

## Что является текущим MVP

### Frontend
Актуальный frontend находится в `frontend/`.

Основная точка входа:
- `frontend/index.html`

Основные runtime-файлы frontend:
- `frontend/css/theme.css`
- `frontend/css/layout.css`
- `frontend/css/mobile.css`
- `frontend/js/core/api-client.js`
- `frontend/js/core/app.js`
- `frontend/components/ui.js`
- `frontend/components/charts.js`
- `frontend/pages/dashboard.js`
- `frontend/pages/labs.js`
- `frontend/pages/appointments.js`
- `frontend/pages/documents.js`
- `frontend/pages/assistant.js`
- `frontend/pages/admin.js`

### Backend
Актуальный backend находится в `backend/`.

Основная точка входа:
- `backend/src/server.js`

Папки runtime backend:
- `backend/src/routes/`
- `backend/src/controllers/`
- `backend/src/services/`
- `backend/src/repositories/`
- `backend/src/db/`
- `backend/src/utils/`
- `backend/src/data/`

## Как запускать проект

Основной способ:

```bash
./run-health-id.command
```

После запуска используются порты:
- frontend: `http://localhost:3000/index.html`
- backend API: `http://localhost:3001/api`
- health endpoint: `http://localhost:3001/api/health`

## Что находится в архиве

Архив неиспользуемого находится в `_archive_unused/`.

После cleanup туда перенесены:
- `_archive_unused/assets_root_legacy_static/` — старый root static слой вне `frontend/`
- `_archive_unused/import_debug/lab_dictionary_full_root_duplicate.csv` — внешний дубликат словаря
- `_archive_unused/import_debug/needs_review.csv` — debug-артефакт импорта
- `_archive_unused/import_debug/needs_review_xlsx.csv` — debug-артефакт импорта

## Важное уточнение по templates

В этом репозитории **нет** активного слоя `templates/` и нет Flask/Jinja runtime.

Следовательно:
- `templates_old_flask` для этого проекта не требуется;
- текущий MVP не зависит от `templates/`, `render_template` и `base.html`;
- подозрение на старый Flask-слой относилось к другому проекту, не к этому репозиторию.

## Какие файлы не трогать

Не трогать:
- `frontend/*`
- `backend/src/*`
- `backend/package.json`
- `backend/package-lock.json`
- `run-health-id.command`
- `README.md`
- `backend/import/dictionaries/lab_dictionary_full.xlsx`
- `backend/import/dictionaries/lab_dictionary_full.csv`
- `backend/storage/documents/*`
- `docs/integration-protocol-lab-report.md`
- `docs/examples/*`

## Что проверять после любых structural changes

1. Запуск `./run-health-id.command`
2. Открытие `http://localhost:3000/index.html`
3. Demo-login с кодом `1234`
4. Переключение 3 demo-пациентов
5. Переходы по routes:
   - dashboard
   - labs
   - assistant
   - appointments
   - documents
   - integration
6. `GET /api/health`
7. Download endpoints:
   - demo PDF
   - integration JSON example
   - integration CSV example
   - integration protocol
