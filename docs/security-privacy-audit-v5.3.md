# Security / Privacy Audit v5.3

Дата проверки: 01.05.2026

Scope: базовый audit перед демонстрацией MVP. Код, бизнес-логика, MySQL schema и импорт справочника не менялись.

Статус обновления: high-risk findings закрыты для локального demo-контура 01.05.2026. Добавлен integration-only GigaChat provider для ассистента с безопасным mock fallback. Это все еще demo-auth, не production-auth.

## Что проверено

- Secrets: `.env`, `.env.example`, `.gitignore`, README/docs, backend/frontend JS, package scripts.
- ПДн: demo-пациенты, seed/json/mock data, docs examples, PDF placeholder, lab data, frontend fallback.
- API privacy: `/api/patient`, `/api/summary`, `/api/labs`, `/api/labs/history`, `/api/lab-reports`, `/api/documents`, `/api/visits`, `/api/appointments/book`, `/api/assistant/chat`, `X-Demo-Patient-Id`.
- Documents download: `/api/documents/:id/download`, принадлежность demo patient, отсутствующие файлы, path traversal.
- Integration downloads: `/api/integration/examples/*`, `/api/integration/protocol/lab-report`.
- Frontend handling: demo-login, выбор 3 пациентов, refresh, logout, missing/invalid demo context.
- Assistant safety: mock provider по умолчанию, опциональный GigaChat provider только через backend `.env`, дисклеймеры, fallback при ошибках provider.

## Итог

MVP можно показывать только как локальный demo на тестовых данных, если явно проговорить ограничения. После fixes backend больше не подставляет `alexey` при missing/invalid demo patient context, frontend не показывает данные default patient автоматически, а lab reports/observations в MySQL читаются с patient scope для явного `alexey`/`p_001`.

Для пилота с реальными пациентами контур все еще не готов: нет production-auth, нет серверной модели ролей, CORS открыт для local demo, а часть legacy demo tables без `patient_id` остается допустимой только для single-patient demo data.

## Найденные риски

| Severity | Статус | Риск | Где найдено | Комментарий |
| --- | --- | --- | --- | --- |
| high | fixed for demo hygiene | Локальный `.env` содержит DB password | `backend/.env`, `.gitignore`, `backend/.env.example` | `.env` оставлен как локальный runtime-файл, `backend/.env` и env variants игнорируются, `.env.example` обновлен до шаблона без секретов. Реальное значение пароля не документируется. |
| high | fixed | Missing/invalid `X-Demo-Patient-Id` silently падал в `alexey` | `backend/src/utils/demoPatientContext.js`, controllers через `getDemoPatientId(req)` | Missing context теперь возвращает `400 demo_context_required`; unknown context возвращает `400 invalid_demo_patient`; default patient больше не отдается молча. |
| high | fixed for lab patient data; partially fixed for legacy single-patient demo tables | MySQL/JSON слой для `alexey` не фильтровался по patient_id | `backend/src/services/labService.js`, `backend/src/repositories/labRepository.js`, `backend/src/repositories/patientRepository.js` | Patient-only lab endpoints для explicit `alexey` читают `p_001`, SQL фильтрует `lab_reports/lab_observations` по `r.patient_id = ?`. Synthetic `anna/dmitry` остаются изолированы in-memory. Reports/documents/visits tables не имеют `patient_id` по текущей schema, поэтому для pilot нужен schema-level ownership. |
| medium | open for pilot | Нет настоящей auth/session модели, demo auth хранится в localStorage | `frontend/js/core/app.js`, `frontend/js/core/api-client.js` | Frontend больше не подставляет `alexey`, но это все еще demo-auth, не production-auth. |
| medium | open for pilot | CORS открыт на все origins | `backend/src/server.js`, `backend/src/utils/corsAdapter.js` | Оставлено для local demo. Перед pilot/production нужен allowlist. |
| medium | open for pilot | Documents table/schema не содержит `patient_id`, ownership для MySQL documents не enforceable | `backend/src/repositories/documentRepository.js`, `backend/src/db/schema.mysql.sql` | Synthetic documents изолированы по demo patient. Для MySQL documents нужен `patient_id` в schema, но schema не менялась по условию задачи. |
| medium | fixed | `/api/documents/:id/download` path traversal hardening | `backend/src/controllers/reportController.js` | Prefix check усилен boundary-проверкой через `storageRoot + path.sep`. |
| medium | open for pilot | Unauthenticated write/import endpoints доступны локально | `/api/labs/import`, `/api/labs/validate`, `/api/integration/lab-report`, `/api/appointments/book` | Оставлено для demo/integration flow. Перед pilot нужны auth/role checks. |
| low | open | Demo-пациенты содержат правдоподобные ФИО, телефоны, birth dates, MIS cards | `backend/src/data/demoPatients.js`, seed/mock data | Данные не менялись. Для внешнего показа проговорить, что пациенты вымышленные. |
| low | open | `run-health-id.command` содержит абсолютный путь к bundled Node в профиле пользователя | `run-health-id.command` | Не секрет; можно убрать перед публичной передачей. |
| low | open for production | Frontend хранит demo profile context в localStorage | `frontend/js/core/app.js` | Для demo допустимо; для production заменить на server session. |

## Secrets / ключи / токены

- `backend/.env` существует как локальный runtime-файл и игнорируется через `.gitignore`.
- `backend/.env.example` содержит только шаблон без реальных секретов: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `AI_ENABLED`, `AI_PROVIDER`.
- В README/docs нет реального DB password.
- OpenAI/Yandex/GigaChat keys, bearer tokens, private keys, cloud keys не найдены.
- `package.json` scripts не содержат секретов.

## API privacy

Проверка после fixes:

- Отсутствующий `X-Demo-Patient-Id` возвращает `400 demo_context_required`.
- Невалидный `X-Demo-Patient-Id` возвращает `400 invalid_demo_patient`.
- `X-Demo-Patient-Id: alexey` возвращает explicit default demo patient `p_001`; автоматического fallback больше нет.
- `X-Demo-Patient-Id: anna` возвращает данные Анны.
- `X-Demo-Patient-Id: dmitry` возвращает данные Дмитрия.
- `dmitry` не может получить `anna_iron_2604` и получает `lab_report_not_found`.
- `anna` не может получить `dmitry_biochem_2704` и получает `lab_report_not_found`.
- Для explicit `alexey` lab endpoints используют storage patient id `p_001`, а MySQL `lab_reports/lab_observations` фильтруются по `patient_id`.

Ограничение: для `medical_reports`, `documents`, `visits` текущая MySQL schema не содержит `patient_id`, поэтому это остается single-patient demo-only и требует schema-level ownership до pilot.

## Documents download

Проверено:

- `GET /api/documents/anna_d_1/download` для `anna`: документ принадлежит пациенту, но физический файл не подключен, корректно возвращается `document_file_not_connected`.
- `GET /api/documents/anna_d_1/download` для `dmitry`: корректно `document_not_found`.
- `GET /api/documents/dmitry_d_1/download` для `anna`: корректно `document_not_found`.
- `GET /api/documents/../../package.json/download`: произвольный файл не отдается.
- Missing demo patient context на `/api/documents` возвращает `400 demo_context_required`.
- Path traversal hardening усилен boundary-проверкой storage root.

## Frontend handling

- Frontend больше не подставляет `alexey` при отсутствии `demoPatientId`.
- При `demo_context_required` или `invalid_demo_patient` frontend показывает: “Демо-пациент не выбран. Вернитесь на экран входа.” и кнопку “К выбору пациента”.
- Browser check: demo-login работает; выбор `alexey`, `anna`, `dmitry` работает; refresh сохраняет выбранного пациента; logout очищает patientId; refresh after logout не показывает данные; console errors не обнаружены.

## Assistant safety

- `backend/src/config/ai.js` по умолчанию: `AI_ENABLED=false`, `AI_PROVIDER=mock`.
- GigaChat включается только через backend `.env`: `AI_ENABLED=true`, `AI_PROVIDER=gigachat`, `GIGACHAT_AUTH_KEY`.
- Ключи и OAuth tokens не выводятся в frontend и не логируются.
- В provider отправляется минимальный контекст: вопрос, режим ассистента, выбранный показатель или краткая лабораторная сводка. PDF, полный профиль пациента, телефон, полис и MIS card не отправляются.
- При ошибке GigaChat, timeout или отсутствии ключа backend возвращает безопасный mock fallback с совместимой структурой ответа.
- Audit log фиксирует `assistant_chat` с provider/status/mode без полного текста вопроса и ответа.
- Runtime response содержит `provider: "mock"` или `provider: "gigachat"`, `aiEnabled`, `providerStatus`.
- Ответы содержат safety-дисклеймеры: не диагноз, не замена врача, без назначений лечения.

Ограничение: GigaChat integration-only режим не является медицински валидированной моделью. Перед пилотом нужны юридическая оценка передачи данных внешнему provider, DPA/договорная база, медицинская валидация сценариев и отдельная production-auth модель.

## Что добавлено для MVP security hygiene

- Добавлены минимальные security headers без новых зависимостей: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`.
- `X-Powered-By` отключен через Express, когда доступен штатный Express runtime.
- Добавлен простой in-memory rate limit:
  - `POST /api/assistant/chat`: 30 запросов / 5 минут / IP;
  - `GET /api/documents/:id/download`: 60 запросов / 5 минут / IP.
- При превышении лимита backend возвращает `HTTP 429` и JSON: `{"error":"too_many_requests","message":"Слишком много запросов. Попробуйте позже."}`.
- Backend login/auth endpoint отсутствует; текущий demo-login остается frontend-only. Отдельный production-auth endpoint не создавался.
- Document download дополнительно ограничен директорией `backend/storage/documents`; файлы вне этой папки не отдаются даже при ошибочном `storageKey`.

## Исправить до показа

1. Не включать `backend/.env` в demo-пак; использовать только `.env.example` как шаблон.
2. Явно пометить проект и UI как локальный demo, не production, пациенты вымышленные.
3. Не открывать backend наружу, не запускать через публичный tunnel.
4. Подготовить короткий дисклеймер для демонстрации: нет production auth/ИБ, нет внешнего AI, данные тестовые.

## Исправить до пилота

1. Ввести server-side auth/session и привязку пользователя к patient_id.
2. Добавить schema-level patient ownership и patient_id scoping во все patient-only tables/queries: documents, medical_reports, visits, appointments, assistant context. Lab reports уже фильтруются по `patient_id` для MySQL demo path.
3. Закрыть import/write endpoints auth/role checks.
4. Ограничить CORS конкретным frontend origin.
5. Добавить безопасную file storage policy и audit log для доступа к patient data/downloads.
6. Убрать реальные/правдоподобные ПДн из frontend fallback или оставить только явно синтетические test identities.

## Что остается до production

- Полноценная IAM/authN/authZ модель, роли, least privilege.
- Secrets management вне репозитория и вне `.env` в поставке.
- HTTPS, secure cookies/session, CSRF policy для browser flows.
- Роли и права доступа для пациента, врача, администратора, интеграционных клиентов.
- Audit logs для просмотра patient data, скачивания документов, импорта и изменений.
- Idempotency keys для integration POST.
- API keys или другой machine-to-machine auth для клиник/МИС/ЛИС.
- Production rate limits через Redis/API gateway, а не in-memory процесс.
- CORS allowlist, request validation, security headers policy для production.
- Шифрование backups/storage, file malware/type validation, retention/deletion policies.
- DPIA/legal basis/consents, privacy notices, журналирование доступа.
- Медицинская валидация assistant сценариев, prompt/data minimization, запрет external provider без DPA и явного правового основания.
- Separate environments: local demo, staging, pilot, production.

## Проверки после fixes

Выполнено 01.05.2026:

1. `node --check` для измененных backend/frontend JS файлов.
2. `GET /api/labs` без `X-Demo-Patient-Id` -> `400 demo_context_required`.
3. `GET /api/labs` с `X-Demo-Patient-Id: unknown` -> `400 invalid_demo_patient`.
4. `GET /api/patient` с `alexey`, `anna`, `dmitry` -> возвращает только выбранного demo patient.
5. `GET /api/labs` с `alexey`, `anna`, `dmitry` -> возвращает разные patient-specific lab sets.
6. `GET /api/lab-reports/anna_iron_2604` с `dmitry` -> `404 lab_report_not_found`.
7. `GET /api/lab-reports/dmitry_biochem_2704` с `anna` -> `404 lab_report_not_found`.
8. `GET /api/documents/anna_d_1/download` с `dmitry` -> `404 document_not_found`.
9. `GET /api/documents/dmitry_d_1/download` с `anna` -> `404 document_not_found`.
10. Browser check: demo-login, выбор 3 пациентов, refresh, logout, no console errors.
11. `GET /api/health` возвращает 200 и содержит MVP security headers.
12. `POST /api/assistant/chat` после превышения demo-лимита возвращает `429 too_many_requests`.
13. `GET /api/documents/d_1/download` с `X-Demo-Patient-Id: alexey` возвращает PDF из `backend/storage/documents`.
14. Integration downloads `/api/integration/examples/lab-report-full-example.json` и `/api/integration/protocol/lab-report` возвращают 200.
