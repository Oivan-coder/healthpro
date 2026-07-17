# Database Model

Current technical MVP supports MySQL with JSON fallback. The same logical model can later be migrated to PostgreSQL if needed.

## users

Authentication account. Main fields: `id`, `phone`, `role`, `created_at`, `updated_at`.

## patients

Patient profile. Main fields: `id`, `user_id`, `full_name`, `birth_date`, `sex`, `policy_number`, `clinic_name`, `region`.

## patient_mis_links

Links an Атлас здоровья patient to clinic systems. Main fields: `patient_id`, `source_system`, `mis_patient_id`, `mis_card`, `verified_at`.

## lab_services

Laboratory services, studies and panels. Examples: ОАК, ОАМ, Биохимия, Липидный профиль, БХ 15. Main fields: `id`, `code`, `source_service_code`, `name`, `kind`, `active`.

## lab_tests

Atomic laboratory tests/indicators. Examples: Гемоглобин, Лейкоциты, Глюкоза, Креатинин. Main fields: `id`, `code`, `source_test_code`, `name`, `default_group`, `unit`, `low_value`, `high_value`, `loinc`, `graphable`.

## lab_service_tests

Many-to-many mapping between services and tests. ОАК can contain HGB/WBC/PLT, and one test can belong to several services. Main fields: `service_id`, `test_id`, `sort_order`, `source_test_code`.

## lab_reports

Concrete patient report for one service. Main fields: `patient_id`, `service_id`, `source_service_code`, `report_date`, `status`, `raw_payload_json`.

## lab_observations

Concrete test values inside a report. Main fields: `report_id`, `test_id`, `source_test_code`, `value_num`, `value_text`, `mapping_status`. Unknown source tests are saved with `mapping_status = unmapped`.

## visits

Clinic visits and appointments received from MIS. Main fields: `patient_id`, `external_visit_id`, `visit_at`, `specialty`, `doctor_name`, `room`, `status`, `note`.

## medical_reports

Doctor conclusions and recommendations. Main fields: `patient_id`, `visit_id`, `title`, `doctor_name`, `report_date`, `status`, `text`.

## documents

Files shown to patient. Main fields: `patient_id`, `title`, `document_type`, `file_url`, `file_size_bytes`, `document_date`.

## appointments

Booking requests created in Атлас здоровья. Main fields: `patient_id`, `specialty`, `doctor_id`, `doctor_name`, `scheduled_at`, `status`, `source_payload`.

## sync_jobs

Integration import jobs. Main fields: `source_system`, `job_type`, `status`, `started_at`, `finished_at`, `imported_count`, `error_count`, `details`.

## audit_logs

Security and access audit. Main fields: `actor_user_id`, `patient_id`, `action`, `entity_type`, `entity_id`, `ip_address`, `metadata`, `created_at`.
