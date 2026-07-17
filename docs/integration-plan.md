# Integration Plan

## Target Data Flow

```text
МИС/ЛИС → API/JSON/CSV → backend Атласа здоровья → БД-витрина → личный кабинет
```

## What Clinic Provides

- Test patients.
- Laboratory result export.
- MIS/LIS engineer contact.
- Local laboratory code dictionary.
- Agreement on pilot contour and data protection process.

## Phase 1

Use JSON or CSV export for 30–50 lab indicators. Normalize local codes into `lab_catalog`, import observations into backend, show results in patient cabinet.

## Phase 2

Replace file import with scheduled API exchange or secure SFTP. Use the existing MySQL data layer, add sync monitoring screens and expand audit logs.

## Phase 3

Add real patient authentication, industrial security controls, legal documents and medically validated interpretation rules.
