# API Contract — Атлас здоровья v5

Base URL: `http://localhost:3001/api`

## GET /health

Returns backend status.

```json
{
  "status": "ok",
  "service": "health-id-backend",
  "version": "5.0.0"
}
```

## GET /patient

Returns current demo patient.

## GET /summary

Returns patient, events, latest labs, next visit, normal/abnormal counters.

## GET /labs

Compatibility endpoint. Returns test dynamics aggregated from lab reports and observations.

## GET /labs/catalog

Compatibility endpoint. Returns normalized `lab_tests`: `code`, `name`, `group`, `unit`, references and `loinc`.

## GET /labs/history

Returns a flat observation history for tables and exports.

## GET /lab-reports

Returns patient laboratory reports. A report is one concrete patient result for one service/panel.

```json
{
  "id": "lr_cbc_25042026",
  "name": "ОАК",
  "date": "25.04.2026",
  "status": "final",
  "serviceCode": "CBC",
  "sourceServiceCode": "CBC",
  "testCount": 3,
  "abnormalCount": 0
}
```

## GET /lab-reports/:id

Returns one report with observations inside it. Observations preserve `sourceTestCode` and normalized Атлас здоровья test `code`.

## GET /lab-reports/:id/pdf

Downloads the original PDF blank for one laboratory report.

Rules:

- Requires current demo patient context via `X-Demo-Patient-Id` header or `demoPatientId` query parameter.
- The report must belong to the selected patient.
- The file is served only from backend-controlled lab report PDF storage.
- The API does not generate a laboratory-signed PDF. It returns the original source file that came from the lab/LIS.
- If the source PDF includes a signature, the file is stored and returned unchanged.

Success:

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="biohimia_25042026_original_lab_blank.pdf"
```

Errors:

```json
{ "error": "lab_report_not_found" }
```

```json
{
  "error": "lab_report_pdf_not_connected",
  "message": "PDF-бланк лабораторного исследования пока не подключен."
}
```

## GET /lab-tests/:testCode/history

Returns dynamics for one normalized test, for example `GLU` or `HGB`.

## POST /integration/lab-report

Imports a complete laboratory report. Unknown test codes are saved as `unmapped`.

```json
{
  "source_service_code": "BH15",
  "date": "15.05.2026",
  "status": "final",
  "observations": [
    { "source_test_code": "GLU", "value": 6.0 },
    { "source_test_code": "LOCAL_UNKNOWN", "value": 123 }
  ]
}
```

## GET /lab-mappings/unmapped

Returns unmapped service/test codes that must be mapped to normalized Атлас здоровья entities.

## POST /labs/import

Compatibility endpoint. New integrations should prefer `POST /integration/lab-report`.

Request:

```json
[
  { "code": "GLU", "value": 6.0, "date": "15.05.2026" }
]
```

Validation errors:

- `unknown_code`
- `invalid_value`
- `missing_date`
- `duplicate_observation`

Response:

```json
{
  "imported": 1,
  "validCount": 1,
  "errorCount": 0,
  "errors": []
}
```

## GET /visits

Returns patient visits.

## POST /appointments/book

Request:

```json
{
  "doctorId": "doc_1",
  "date": "26.04",
  "slot": "11:30"
}
```

Creates a demo visit and returns it.

## GET /reports

Returns medical reports.

## GET /documents

Returns patient documents.

Note: `/documents` is the general patient document folder. Laboratory source PDFs are tied to concrete lab reports and are downloaded through `GET /lab-reports/:id/pdf`.

## GET /integration/status

Returns integration mode, last sync and production gaps.
