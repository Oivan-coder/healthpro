# Атлас здоровья Lab Report Integration Protocol Draft

## Purpose

This draft describes the minimal laboratory report payload needed for a clinic demo integration. It is intended for a test or anonymized export, not for production personal data exchange.

## Endpoint

`POST /api/integration/lab-report`

## Required Report Fields

- `source_service_code`: local LIS/MIS service code.
- `date`: report date in `DD.MM.YYYY`.
- `status`: report status, for example `final`.
- `observations`: array of laboratory observations.

## Required Observation Fields

- `source_test_code`: local LIS/MIS test code.
- `value`: numeric or text result value.
- `unit`: result unit when available.
- `reference_low`: lower reference boundary when available.
- `reference_high`: upper reference boundary when available.

## Original PDF Blank

For pilot use, the PDF is treated as the source-of-truth document from the laboratory/LIS.

- The system must not generate a “signed by laboratory” PDF by itself.
- If the lab/LIS provides a signed PDF, Атлас здоровья stores that original file unchanged.
- If there is no signature, the file can still be stored with `signature_status: "not_signed"` or `unknown`.
- The file metadata is stored separately from observations and linked by `lab_report_id` and `patient_id`.
- Minimal metadata: `storage_key`, `source_filename`, `content_type`, `file_size`, optional `checksum_sha256`, `signature_status`, `created_at`.
- Patient download endpoint: `GET /api/lab-reports/:id/pdf`.
- The endpoint checks patient ownership and serves only files from backend-controlled storage.

Current MVP does not verify electronic signatures. Production/pilot integration should preserve the original file and add verification later if the clinic requires it.

## Demo Safety Scope

- Use 20-50 test or anonymized laboratory reports.
- Use only synthetic or anonymized PDF blanks in local demo.
- Do not send real personal data at the first stage.
- Do not provide production MIS/LIS access at the first stage.
- Provide a local code dictionary and one engineer contact for mapping questions.
