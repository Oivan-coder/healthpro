# Атлас здоровья — технический MVP v5

Атлас здоровья — ранний технический MVP личного кабинета пациента. Рабочее техническое имя проекта в коде может оставаться `health-id`. Это уже не только кликабельный HTML-макет: проект разделен на frontend и Express backend API, лабораторные данные хранятся в MySQL через repository/data layer, импортируются через JSON и подготовлены к будущей интеграции с МИС/ЛИС.

Текущая версия дополнительно сфокусирована на пациентском UX: главный экран, лаборатория, профиль и вход приведены к более чистому Apple-like интерфейсу без технического шума на пациентских страницах.

## Структура

```text
frontend/
  css/
  js/
  pages/
  components/
  index.html
backend/
  src/
    server.js
    routes/
    controllers/
    services/
    data/
    db/
    utils/
  package.json
docs/
  api-contract.md
  database-model.md
  integration-plan.md
  pilot-plan.md
  next-steps.md
```

## Запуск backend

Самый простой запуск одной командой:

```bash
./run-health-id.command
```

И открыть `http://localhost:3000/index.html`.

Если Node.js и npm установлены, можно запускать backend отдельно:

```bash
cd backend
npm install
npm run dev
```

Backend запускается на `http://localhost:3001`.

## MySQL режим

Реальный `.env` не хранится в проекте. Создайте его локально сами:

```bash
cd backend
cp .env.example .env
```

Откройте `backend/.env` и заполните свои локальные значения. Пример:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=health_id_mvp
USE_DB=mysql
```

Создать БД, применить схему и загрузить демо-данные:

```bash
cd backend
npm install
npm run db:init
npm run db:seed
npm run dev
```

Команды используют:

- [backend/src/db/schema.mysql.sql](backend/src/db/schema.mysql.sql)
- [backend/src/db/seed.mysql.sql](backend/src/db/seed.mysql.sql)

Если MySQL недоступен, backend автоматически использует JSON fallback, чтобы frontend не ломался.

Лабораторная схема MySQL использует:

- `lab_services` — исследования/услуги/панели;
- `lab_tests` — отдельные показатели;
- `lab_service_tests` — связь услуги и показателей;
- `lab_reports` — конкретный отчет пациента;
- `lab_report_documents` — оригинальный PDF-бланк лабораторного отчета, привязанный к `lab_report_id` и `patient_id`;
- `lab_observations` — значения показателей внутри отчета.
- `audit_events` — минимальный журнал действий MVP: скачивания, импорты, записи и отказанные попытки доступа.

Если у вас уже была старая тестовая БД `health_id_mvp` с плоской лабораторной схемой, для локального демо проще создать новую БД или удалить старую после резервной копии.

## Вернуться на JSON fallback

В `backend/.env` поставьте:

```env
USE_DB=json
```

И перезапустите backend. Можно также временно удалить или переименовать `.env`: по умолчанию backend работает на JSON.

## Assistant AI provider

По умолчанию помощник работает в безопасном mock-режиме и не отправляет медицинские данные во внешние сервисы:

```env
AI_ENABLED=false
AI_PROVIDER=mock
```

Для локальной проверки GigaChat в `backend/.env` можно включить:

```env
AI_ENABLED=true
AI_PROVIDER=gigachat
GIGACHAT_AUTH_KEY=
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat-2
GIGACHAT_REJECT_UNAUTHORIZED=true
```

`GIGACHAT_AUTH_KEY` — это auth/authorization data для Basic OAuth. Если вместо него есть пара из кабинета Сбера, можно указать `GIGACHAT_CLIENT_ID` и `GIGACHAT_CLIENT_SECRET`, backend соберет auth key сам. Если локально Node падает с `SELF_SIGNED_CERT_IN_CHAIN`, временно поставьте `GIGACHAT_REJECT_UNAUTHORIZED=false`; для staging/production нужно вернуть `true` и подключить сертификат через `GIGACHAT_CA_CERT_PATH`. Секреты хранятся только в backend `.env`, не попадают во frontend и не должны попадать в архивы/документацию. Backend отправляет в provider только минимальный контекст: вопрос, режим помощника и краткие лабораторные сведения без PDF-файлов и без полного профиля пациента. Если внешний AI возвращает диагнозоподобные формулировки или упоминания лечения, backend включает safety guard и заменяет ответ на безопасный шаблон подготовки вопросов врачу. При ошибке авторизации, timeout или недоступности GigaChat UI получает безопасный mock fallback.

Помощник не ставит диагнозы, не назначает лечение, не рекомендует начать/отменить препараты и не заменяет врача. Это integration-only режим; реальные медицинские сценарии требуют последующей врачебной валидации.

## Запуск frontend

Откройте `frontend/index.html` в браузере. Frontend обращается к `http://localhost:3001/api`.

Опционально можно поднять простой static server:

```bash
cd frontend
python3 -m http.server 3000
```

После этого откройте `http://localhost:3000`.

Если backend не запущен, приложение останется работоспособным в аварийном frontend fallback-режиме и покажет подпись: `Режим: аварийный локальный fallback`. В нормальном запуске данные идут через `http://localhost:3001/api`, а backend читает MySQL.

## Текущий статус

- Локальный технический MVP.
- Архитектура: frontend + backend API + MySQL.
- Данные сейчас загружаются из demo seed.
- Реальная МИС/ЛИС пока не подключена.
- JSON fallback сохранен только как аварийный режим backend, если MySQL временно недоступна.
- Пациентский frontend обновлен: вход, главная, лаборатория и профиль визуально подготовлены для показа клинике.
- Навигация frontend восстановлена и проверена: отдельные route для главной, лаборатории, истории анализов, профиля и интеграции.
- Технические статусы backend/mock/localhost убраны с пациентских экранов и оставлены для раздела интеграции/технического статуса.

## API endpoint-ы

- `GET /api/health`
- `GET /api/patient`
- `GET /api/summary`
- `GET /api/labs`
- `GET /api/labs/catalog`
- `GET /api/labs/history`
- `POST /api/labs/import`
- `GET /api/lab-reports`
- `GET /api/lab-reports/:id`
- `GET /api/lab-reports/:id/pdf`
- `GET /api/lab-tests/:testCode/history`
- `POST /api/integration/lab-report`
- `GET /api/lab-mappings/unmapped`
- `GET /api/visits`
- `POST /api/appointments/book`
- `GET /api/reports`
- `GET /api/documents`
- `GET /api/integration/status`
- `GET /api/audit/events`
- `POST /api/assistant/chat`

## Импорт лабораторных данных

Основной формат интеграционного импорта — `POST /api/integration/lab-report`. Он отражает правильную лабораторную модель: пациент, отчет/исследование и значения показателей внутри отчета.

```json
{
  "patient": {
    "misPatientId": "mis_884219",
    "misCard": "MIS-248019"
  },
  "report": {
    "sourceSystem": "clinic_lis",
    "sourceReportId": "LAB-2026-00045",
    "sourceServiceCode": "BH15",
    "serviceCode": "BIOCHEM",
    "name": "Биохимия крови",
    "date": "15.05.2026",
    "status": "final"
  },
  "observations": [
    {
      "sourceTestCode": "GLU",
      "testCode": "GLU",
      "value": 6.0,
      "unit": "ммоль/л"
    },
    {
      "sourceTestCode": "CREA",
      "testCode": "CREA",
      "value": 88,
      "unit": "мкмоль/л"
    }
  ]
}
```

Backend сопоставляет `sourceServiceCode` и `sourceTestCode` со справочниками Атласа здоровья. Если показатель не сопоставлен, данные не теряются: запись сохраняется как `unmapped` для последующего маппинга.

Legacy/simple import также сохранен: `POST /api/labs/import`.

```json
[
  { "code": "GLU", "value": 6.0, "date": "15.05.2026" },
  { "code": "CHOL", "value": 5.4, "date": "15.05.2026" }
]
```

Этот формат удобен для быстрых ручных проверок, но для интеграции с ЛИС/МИС основным считается `POST /api/integration/lab-report`.

## PDF лабораторного исследования

Для пилотного контура добавлен безопасный download-flow оригинального PDF-бланка лабораторного исследования:

- PDF хранится как исходный файл, полученный из лаборатории/ЛИС.
- Система не генерирует “подписанный лабораторией” PDF и не подменяет подпись лаборатории.
- Если лабораторная подпись есть внутри файла, файл сохраняется и отдается как есть.
- Связь хранится отдельно: `lab_report_id`, `patient_id`, `storage_key`, `source_filename`, `content_type`, `file_size`, `checksum_sha256`, `signature_status`, `created_at`.
- Endpoint: `GET /api/lab-reports/:id/pdf`.
- Endpoint требует demo patient context и проверяет, что отчет принадлежит выбранному пациенту.
- Файл отдается только из безопасной папки `backend/storage/lab-report-pdfs`; path traversal не используется.
- Если PDF не подключен, API возвращает `404` и `lab_report_pdf_not_connected`.

В demo подключен один синтетический PDF без реальных ПДн: `lr_biochem_25042026` для пациента `alexey`.

## Audit log MVP

Добавлен минимальный журнал действий для пилотного медицинского контура:

- `GET /api/audit/events` возвращает последние 50 событий.
- Endpoint пока demo/admin-only и не является production-auth.
- Логируются: скачивание PDF лабораторного отчета, отказ/отсутствие PDF, скачивание обычного документа, импорт лабораторного отчета, создание записи к врачу.
- В журнал пишутся `event_type`, `patient_id`, `actor_type`, `actor_id`, `resource_type`, `resource_id`, `status`, `ip`, `user_agent`, `details_json`, `created_at`.
- В MySQL используется таблица `audit_events`; в JSON fallback — `backend/src/data/auditEvents.json`.
- Это демо-заготовка audit trail, не SIEM и не промышленный журнал ИБ.

## Что готово

- Apple-like frontend с адаптивом, карточками, мягкими тенями, нижней мобильной навигацией и графиками.
- Пациентский экран входа с вкладками `Вход` / `Регистрация`, согласием на обработку данных и демо-сценарием.
- Главная страница как пациентская сводка здоровья: что нового, показатели внимания, последние исследования, быстрые действия.
- Лаборатория с режимами `Исследования`, `Требуют внимания`, `Динамика`.
- Избранные лабораторные показатели: пациент может отметить показатели звездочкой, чтобы видеть их выше в лаборатории и использовать для графика на главной.
- Профиль пациента в более чистом пациентском стиле: основные данные, статус доступа, быстрые действия.
- Express backend API.
- MySQL data layer через `mysql2/promise` и repositories.
- JSON fallback при `USE_DB=json` или недоступной MySQL.
- Лабораторная модель разделяет услуги/панели, тесты, связи, отчеты и наблюдения.
- Лабораторная витрина: отчеты исследований, тесты внутри отчета, референсы, статусы, динамика.
- Скачивание оригинального PDF-бланка лабораторного отчета для подключенных исследований.
- Минимальный audit log для действий download/import/booking.
- История лабораторных наблюдений.
- JSON-импорт лабораторных значений.
- Демо-запись к врачу через API.
- Страница интеграции с планом подключения МИС/ЛИС.
- Черновая SQL-схема для будущих миграций также лежит в `backend/src/db/schema.sql`.

## Что обновлено в последнем UI-polish этапе

- Исправлена frontend-навигация после конфликта глобальных констант в обычных `<script>`.
- Обновлена страница входа: меньше текста, чище УТП, аккуратное мини-превью кабинета.
- Добавлена регистрационная вкладка без настоящей SMS-логики.
- Добавлен frontend-only logout.
- На мобильной версии основной навигацией стала нижняя панель.
- Обновлен профиль пациента: меньше технических терминов, больше понятных пациенту статусов.
- Обновлен hero лаборатории: компактнее заголовок, понятнее метрики, лучше адаптив.
- Страница лаборатории поддерживает список показателей, требующих внимания: если последний результат нормальный, показатель больше не попадает в этот список.

## Что еще не промышленный контур

- Нет настоящей SMS/OTP-авторизации.
- Нет промышленных миграций и управления секретами.
- Нет реального подключения МИС/ЛИС.
- Нет промышленной проверки электронной подписи PDF.
- Audit log пока demo/admin-only, без SIEM, WORM-хранилища и production RBAC.
- Нет промышленного ИБ/юридического контура.
- Нет медицински валидированного ИИ-пояснения.
- Нет платежей и сложной регистрации.

## Следующий шаг

Сначала сделать интеграционный симулятор и загрузку тестовой/обезличенной выгрузки JSON/CSV. Затем подключить тестовый API-контур клиники, расширить seed до нескольких пациентов и провести пилот на 50–200 пациентах и 30–50 лабораторных показателях.

## Smoke-проверки PDF-flow

```bash
curl -s http://localhost:3001/api/health
curl -s -H "X-Demo-Patient-Id: alexey" http://localhost:3001/api/lab-reports
curl -s -o /tmp/lab-report.pdf -w "%{http_code} %{content_type}\n" -H "X-Demo-Patient-Id: alexey" http://localhost:3001/api/lab-reports/lr_biochem_25042026/pdf
curl -s -w "%{http_code}\n" -H "X-Demo-Patient-Id: anna" http://localhost:3001/api/lab-reports/lr_biochem_25042026/pdf
curl -s -H "X-Demo-Patient-Id: alexey" http://localhost:3001/api/lab-reports/lr_lipid_25042026/pdf
node --check backend/src/controllers/labController.js
node --check backend/src/services/labService.js
node --check backend/src/repositories/labReportDocumentRepository.js
node --check frontend/js/core/api-client.js
node --check frontend/pages/labs.js
```
