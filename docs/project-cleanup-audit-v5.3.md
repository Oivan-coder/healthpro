# Project Cleanup Audit v5.3

## Scope

Аудит выполнен для реального MVP, который запускается через `./run-health-id.command` и работает на:

- frontend: `http://localhost:3000/index.html`
- backend API: `http://localhost:3001/api`

## Ключевой вывод

В текущем репозитории **нет** активного Flask/Jinja слоя и **нет** папки `templates/`.
Текущий MVP использует:

- статический frontend из `frontend/`
- Express backend из `backend/src/`
- запуск через `run-health-id.command`

Поиск по проекту не нашёл активных ссылок на:

- `templates/`
- `render_template`
- `Flask`
- `base.html`
- `dashboard.html`
- `login.html`

Следовательно, подозрение на старый Flask-слой относится не к этому репозиторию, а к другому проекту.

## Inventory: основные папки

| Папка | Назначение | Статус |
|---|---|---|
| `frontend/` | Актуальный frontend MVP, который реально открывается на `localhost:3000` | Используется |
| `backend/` | Node/Express backend API, который реально отвечает на `localhost:3001/api` | Используется |
| `backend/src/` | Исходники backend: routes, controllers, services, repositories, db, utils | Используется |
| `backend/import/` | Словарь и debug-артефакты импорта лабораторного справочника | Частично используется |
| `backend/storage/` | Локальное хранилище demo-документов | Используется |
| `docs/` | Актуальная проектная документация и integration examples | Используется |
| `assets/` | Старый параллельный статический слой вне `frontend/` | Не используется текущим MVP |
| `frontend/assets/` | В текущем MVP используется только `assets/icons/atlas-icon.svg` через manifest; `assets/js/*` не подключаются | Частично используется |
| `_archive_unused/` | Архив неиспользуемых файлов после cleanup | Будет создан |

## A. Используется в текущем MVP

| путь | назначение | почему используется | где подключается |
|---|---|---|---|
| `run-health-id.command` | основной launcher | запускает backend на `3001` и static frontend на `3000` | прямой запуск |
| `README.md` | корневая инструкция по проекту | описывает запуск, структуру, API и импорт | ручное использование |
| `index.html` | root redirect stub | перенаправляет в `frontend/index.html`, полезен при открытии корня проекта | meta refresh |
| `frontend/index.html` | основная HTML-точка входа frontend | реально открывается на `localhost:3000/index.html` | браузер / launcher |
| `frontend/css/theme.css` | тема frontend | подключён из `frontend/index.html` | `<link rel="stylesheet">` |
| `frontend/css/layout.css` | layout frontend | подключён из `frontend/index.html` | `<link rel="stylesheet">` |
| `frontend/css/mobile.css` | mobile-адаптация frontend | подключён из `frontend/index.html` | `<link rel="stylesheet">` |
| `frontend/manifest.webmanifest` | web manifest | подключён из `frontend/index.html` | `<link rel="manifest">` |
| `frontend/assets/icons/atlas-icon.svg` | иконка приложения | используется manifest | `frontend/manifest.webmanifest` |
| `frontend/components/ui.js` | UI-хелперы frontend | подключён из `frontend/index.html` | `<script src>` |
| `frontend/components/charts.js` | графики frontend | подключён из `frontend/index.html` | `<script src>` |
| `frontend/js/core/api-client.js` | клиент для `http://localhost:3001/api` | подключён из `frontend/index.html`, используется всеми page-модулями | `<script src>` |
| `frontend/js/core/app.js` | bootstrap, demo-login, routing, state переходов | подключён из `frontend/index.html` | `<script src>` |
| `frontend/pages/dashboard.js` | dashboard route | подключён из `frontend/index.html` | `<script src>` |
| `frontend/pages/labs.js` | labs route | подключён из `frontend/index.html` | `<script src>` |
| `frontend/pages/appointments.js` | appointments + visits routes | подключён из `frontend/index.html` | `<script src>` |
| `frontend/pages/documents.js` | documents/reports route | подключён из `frontend/index.html` | `<script src>` |
| `frontend/pages/assistant.js` | assistant route | подключён из `frontend/index.html` | `<script src>` |
| `frontend/pages/admin.js` | integration/profile routes | подключён из `frontend/index.html` | `<script src>` |
| `backend/package.json` | backend scripts и зависимости | используется launcher и npm scripts | `node src/server.js`, npm scripts |
| `backend/package-lock.json` | lockfile backend | фиксирует runtime-зависимости | npm install/runtime |
| `backend/src/server.js` | HTTP API server | реально запускается launcher-скриптом | `run-health-id.command` |
| `backend/src/routes/*` | регистрация API-маршрутов | используются server.js | `backend/src/server.js` |
| `backend/src/controllers/*` | контроллеры API | используются route-модулями | `backend/src/routes/*` |
| `backend/src/services/*` | бизнес-слой API | используются контроллерами | `backend/src/controllers/*` |
| `backend/src/repositories/*` | data-access слой | используются services | `backend/src/services/*` |
| `backend/src/utils/*` | infra/utils | используются server/routes/services | `backend/src/*` |
| `backend/src/db/*` | DB/config/init/schema/seed | используется backend и import scripts | `backend/package.json`, repositories |
| `backend/src/data/*` | demo dataset backend | используется repositories/services | `backend/src/repositories/*` |
| `backend/import/dictionaries/lab_dictionary_full.csv` | основной fallback/source для dictionary import | используется import docs и import script | `docs/dictionary-import.md`, `backend/src/import/dictionaryImport.js` |
| `backend/import/dictionaries/lab_dictionary_full.xlsx` | исходный XLSX словарь | используется import script | `backend/src/import/dictionaryImport.js` |
| `backend/storage/documents/d_1.pdf` | demo PDF для downloads | используется `/api/documents/:id/download` | `backend/src/controllers/reportController.js` |
| `docs/integration-protocol-lab-report.md` | integration protocol download | отдается backend | `backend/src/controllers/integrationController.js` |
| `docs/examples/lab-report-full-example.json` | demo integration JSON download | отдается backend | `backend/src/controllers/integrationController.js` |
| `docs/examples/lab-export-fields.csv` | demo integration CSV download | отдается backend | `backend/src/controllers/integrationController.js` |
| `docs/api-contract.md` | актуальная документация API | полезна для поддержки MVP | docs |
| `docs/database-model.md` | актуальная модель данных | полезна для поддержки MVP | docs |
| `docs/dictionary-import.md` | инструкция по импорту словаря | связана с `dictionary:inspect/import` | docs |
| `docs/assistant-knowledge-base.md` | описание ассистента | поддерживающая документация | docs |
| `docs/integration-plan.md` | integration documentation | поддерживающая документация | docs |
| `docs/pilot-plan.md` | pilot documentation | поддерживающая документация | docs |
| `docs/next-steps.md` | roadmap / status | поддерживающая документация | docs |

## B. Не используется текущим MVP, но лучше сохранить в архив

| путь | причина | рекомендация |
|---|---|---|
| `assets/` | старый параллельный статический слой вне `frontend/`; в runtime не подключается, в launch script не участвует, ссылок по проекту нет | move to archive |
| `lab_dictionary_full.csv` | полный дубликат `backend/import/dictionaries/lab_dictionary_full.csv`; в коде и docs не используется | move to archive |
| `backend/import/dictionaries/needs_review.csv` | debug/output артефакт previous dictionary inspect/import; runtime MVP не использует | move to archive |
| `backend/import/dictionaries/needs_review_xlsx.csv` | debug/output артефакт previous dictionary inspect/import; runtime MVP не использует | move to archive |

## C. Можно удалить безопасно

| путь | почему безопасно удалить | чем подтверждено |
|---|---|---|
| `.DS_Store` | системный мусор macOS, не участвует в runtime | inventory проекта |
| `backend/.DS_Store` | системный мусор macOS, не участвует в runtime | inventory проекта |
| `backend/import/.DS_Store` | системный мусор macOS, не участвует в runtime | inventory проекта |

## D. Нельзя трогать

| путь | почему нельзя трогать |
|---|---|
| `frontend/*` | прямое ограничение задачи; это актуальный frontend MVP |
| `backend/src/*` | прямое ограничение задачи; это актуальный backend MVP |
| `backend/package.json` | прямое ограничение задачи; нужен для запуска backend |
| `backend/package-lock.json` | прямое ограничение задачи; фиксирует runtime-зависимости |
| `backend/storage/documents/*` | прямое ограничение задачи; нужен demo download PDF |
| `backend/import/dictionaries/lab_dictionary_full.xlsx` | прямое ограничение задачи; используется import script |
| `backend/import/dictionaries/lab_dictionary_full.csv` | прямое ограничение задачи; используется как fallback/source для import |
| `docs/integration-protocol-lab-report.md` | прямое ограничение задачи; backend отдает этот файл по API |
| `docs/examples/*` | прямое ограничение задачи; backend отдает эти файлы по API |
| `run-health-id.command` | прямое ограничение задачи; это основной launcher |
| `README.md` | прямое ограничение задачи; содержит актуальные инструкции |
| `frontend/assets/icons/atlas-icon.svg` | используется `manifest.webmanifest`; относится к `frontend/*` |
| `frontend/assets/js/*` | по audit не используется текущим runtime, но лежит внутри `frontend/*`, а значит по условию задачи не трогаем |
| `frontend/js/core/store.js` | по audit не подключен текущим `frontend/index.html`, но лежит внутри `frontend/*`, а значит по условию задачи не трогаем |
| `frontend/js/data/mock-db.js` | по audit не подключен текущим `frontend/index.html`, но лежит внутри `frontend/*`, а значит по условию задачи не трогаем |
| `index.html` | не критичен для localhost:3000, но полезен как безопасный redirect stub при открытии корня проекта |
| `backend/.env` | локальный runtime config пользователя |
| `backend/.env.example` | шаблон конфигурации |
| `backend/README.md` | вспомогательная документация backend |

## E. Риски

| риск | что может сломаться | как проверить после cleanup |
|---|---|---|
| ошибочно перемещен runtime frontend-файл | `localhost:3000/index.html` потеряет стили, роутинг или demo-login | перезапуск `./run-health-id.command`, открыть frontend, пройти demo-login |
| ошибочно перемещен backend runtime-файл | `localhost:3001/api` перестанет отвечать | проверить `/api/health`, summary, labs, documents, integration |
| ошибочно перемещен download-asset | перестанет скачиваться demo PDF или integration example | скачать `/api/documents/:id/download`, example JSON/CSV/protocol |
| ошибочно перемещен dictionary source | сломаются `dictionary:inspect`/`dictionary:import` | не трогать `backend/import/dictionaries/lab_dictionary_full.*`; проверить наличие файлов |
| перенос файлов внутри `frontend/*` | можно сломать будущие fallback/legacy сценарии, даже если они не участвуют в текущем runtime | по условию задачи ничего внутри `frontend/*` не переносить |

## Дополнительные замечания

1. `templates/` в этом репозитории отсутствует. Перенос `templates -> _archive_unused/templates_old_flask` для данного проекта неприменим.
2. В проекте есть исторический mock/static-слой:
   - `assets/`
   - `frontend/assets/js/*`
   - `frontend/js/core/store.js`
   - `frontend/js/data/mock-db.js`

   Но по условию задачи можно безопасно архивировать только внешний слой `assets/` и внешние debug-файлы. Внутренние файлы под `frontend/*` зафиксированы в audit как нетекущие, но не трогаются.
