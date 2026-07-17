SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE appointments;
TRUNCATE TABLE audit_events;
TRUNCATE TABLE sync_jobs;
TRUNCATE TABLE events;
TRUNCATE TABLE documents;
TRUNCATE TABLE medical_reports;
TRUNCATE TABLE visits;
TRUNCATE TABLE lab_observations;
TRUNCATE TABLE lab_report_documents;
TRUNCATE TABLE lab_reports;
TRUNCATE TABLE lab_service_tests;
TRUNCATE TABLE lab_test_references;
TRUNCATE TABLE lab_source_mappings;
TRUNCATE TABLE patient_mis_links;
TRUNCATE TABLE lab_tests;
TRUNCATE TABLE lab_services;
TRUNCATE TABLE patients;
SET FOREIGN_KEY_CHECKS=1;

INSERT INTO patients (id, mis_patient_id, mis_card, name, initials, phone, birth_date, age, sex, policy, clinic, region) VALUES
  ('p_001', 'mis_884219', 'MIS-248019', 'Алексей Петров', 'АП', '+7 900 123-45-67', '1983-08-14', 42, 'Мужской', 'ОМС •••• 9381', 'Частная клиника «Пилот»', 'Московская область')
ON DUPLICATE KEY UPDATE id=VALUES(id), mis_patient_id=VALUES(mis_patient_id), mis_card=VALUES(mis_card), name=VALUES(name), initials=VALUES(initials), phone=VALUES(phone), birth_date=VALUES(birth_date), age=VALUES(age), sex=VALUES(sex), policy=VALUES(policy), clinic=VALUES(clinic), region=VALUES(region);

INSERT INTO patient_mis_links (patient_id, source_system, mis_patient_id, mis_card, verified_at) VALUES
  ('p_001', 'demo', 'mis_884219', 'MIS-248019', NOW())
ON DUPLICATE KEY UPDATE patient_id=VALUES(patient_id), source_system=VALUES(source_system), mis_patient_id=VALUES(mis_patient_id), mis_card=VALUES(mis_card), verified_at=VALUES(verified_at);

INSERT INTO lab_services (id, code, source_service_code, name, kind, active) VALUES
  ('svc_biochem', 'BIOCHEM', 'BIOCHEM', 'Биохимия', 'panel', 1),
  ('svc_lipid', 'LIPID', 'LIPID', 'Липидный профиль', 'panel', 1),
  ('svc_cbc', 'CBC', 'CBC', 'ОАК', 'panel', 1),
  ('svc_inflam', 'INFLAM', 'INFLAM', 'Воспаление', 'panel', 1),
  ('svc_coag', 'COAG', 'COAG', 'Коагулограмма', 'panel', 1),
  ('svc_hormones', 'HORMONES', 'HORMONES', 'Гормоны', 'panel', 1),
  ('svc_bh15', 'BH15', 'BH15', 'БХ 15', 'panel', 1)
ON DUPLICATE KEY UPDATE id=VALUES(id), code=VALUES(code), source_service_code=VALUES(source_service_code), name=VALUES(name), kind=VALUES(kind), active=VALUES(active);

INSERT INTO lab_tests (id, code, source_test_code, name, default_group, unit, low_value, high_value, loinc, graphable, active) VALUES
  ('test_glu', 'GLU', 'GLU', 'Глюкоза', 'Биохимия', 'ммоль/л', 3.9, 5.5, '2345-7', 1, 1),
  ('test_hba1c', 'HBA1C', 'HBA1C', 'HbA1c', 'Биохимия', '%', 4, 5.6, '4548-4', 1, 1),
  ('test_crea', 'CREA', 'CREA', 'Креатинин', 'Биохимия', 'мкмоль/л', 62, 106, '2160-0', 1, 1),
  ('test_alt', 'ALT', 'ALT', 'АЛТ', 'Биохимия', 'Ед/л', 0, 41, '1742-6', 1, 1),
  ('test_ast', 'AST', 'AST', 'АСТ', 'Биохимия', 'Ед/л', 0, 40, '1920-8', 1, 1),
  ('test_chol', 'CHOL', 'CHOL', 'Общий холестерин', 'Липидный профиль', 'ммоль/л', 0, 5.2, '2093-3', 1, 1),
  ('test_ldl', 'LDL', 'LDL', 'ЛПНП', 'Липидный профиль', 'ммоль/л', 0, 3, '13457-7', 1, 1),
  ('test_hdl', 'HDL', 'HDL', 'ЛПВП', 'Липидный профиль', 'ммоль/л', 1, 99, '2085-9', 1, 1),
  ('test_tg', 'TG', 'TG', 'Триглицериды', 'Липидный профиль', 'ммоль/л', 0, 1.7, '2571-8', 1, 1),
  ('test_hgb', 'HGB', 'HGB', 'Гемоглобин', 'ОАК', 'г/л', 130, 170, '718-7', 1, 1),
  ('test_wbc', 'WBC', 'WBC', 'Лейкоциты', 'ОАК', '10⁹/л', 4, 9, '6690-2', 1, 1),
  ('test_plt', 'PLT', 'PLT', 'Тромбоциты', 'ОАК', '10⁹/л', 150, 400, '777-3', 1, 1),
  ('test_esr', 'ESR', 'ESR', 'СОЭ', 'Воспаление', 'мм/ч', 0, 15, '4537-7', 1, 1),
  ('test_crp', 'CRP', 'CRP', 'СРБ', 'Воспаление', 'мг/л', 0, 5, '1988-5', 1, 1),
  ('test_inr', 'INR', 'INR', 'МНО', 'Коагулограмма', '', 0.85, 1.15, '6301-6', 1, 1),
  ('test_fib', 'FIB', 'FIB', 'Фибриноген', 'Коагулограмма', 'г/л', 2, 4, '3255-7', 1, 1),
  ('test_tsh', 'TSH', 'TSH', 'ТТГ', 'Гормоны', 'мМЕ/л', 0.4, 4, '3016-3', 1, 1),
  ('test_vitd', 'VITD', 'VITD', 'Витамин D', 'Гормоны', 'нг/мл', 30, 100, '1989-3', 1, 1)
ON DUPLICATE KEY UPDATE id=VALUES(id), code=VALUES(code), source_test_code=VALUES(source_test_code), name=VALUES(name), default_group=VALUES(default_group), unit=VALUES(unit), low_value=VALUES(low_value), high_value=VALUES(high_value), loinc=VALUES(loinc), graphable=VALUES(graphable), active=VALUES(active);

INSERT INTO lab_service_tests (service_id, test_id, sort_order, source_test_code) VALUES
  ('svc_biochem', 'test_glu', 1, 'GLU'),
  ('svc_biochem', 'test_hba1c', 2, 'HBA1C'),
  ('svc_biochem', 'test_crea', 3, 'CREA'),
  ('svc_biochem', 'test_alt', 4, 'ALT'),
  ('svc_biochem', 'test_ast', 5, 'AST'),
  ('svc_lipid', 'test_chol', 6, 'CHOL'),
  ('svc_lipid', 'test_ldl', 7, 'LDL'),
  ('svc_lipid', 'test_hdl', 8, 'HDL'),
  ('svc_lipid', 'test_tg', 9, 'TG'),
  ('svc_cbc', 'test_hgb', 10, 'HGB'),
  ('svc_cbc', 'test_wbc', 11, 'WBC'),
  ('svc_cbc', 'test_plt', 12, 'PLT'),
  ('svc_inflam', 'test_esr', 13, 'ESR'),
  ('svc_inflam', 'test_crp', 14, 'CRP'),
  ('svc_coag', 'test_inr', 15, 'INR'),
  ('svc_coag', 'test_fib', 16, 'FIB'),
  ('svc_hormones', 'test_tsh', 17, 'TSH'),
  ('svc_hormones', 'test_vitd', 18, 'VITD'),
  ('svc_bh15', 'test_glu', 1, 'GLU'),
  ('svc_bh15', 'test_crea', 2, 'CREA'),
  ('svc_bh15', 'test_alt', 3, 'ALT'),
  ('svc_bh15', 'test_ast', 4, 'AST'),
  ('svc_bh15', 'test_chol', 5, 'CHOL'),
  ('svc_bh15', 'test_ldl', 6, 'LDL'),
  ('svc_bh15', 'test_hdl', 7, 'HDL'),
  ('svc_bh15', 'test_tg', 8, 'TG'),
  ('svc_bh15', 'test_crp', 9, 'CRP'),
  ('svc_bh15', 'test_hba1c', 10, 'HBA1C')
ON DUPLICATE KEY UPDATE service_id=VALUES(service_id), test_id=VALUES(test_id), sort_order=VALUES(sort_order), source_test_code=VALUES(source_test_code);

INSERT INTO lab_reports (id, patient_id, service_id, source_service_code, report_date, status, raw_payload_json) VALUES
  ('lr_biochem_10012026', 'p_001', 'svc_biochem', 'BIOCHEM', '2026-01-10', 'final', NULL),
  ('lr_biochem_07022026', 'p_001', 'svc_biochem', 'BIOCHEM', '2026-02-07', 'final', NULL),
  ('lr_biochem_02032026', 'p_001', 'svc_biochem', 'BIOCHEM', '2026-03-02', 'final', NULL),
  ('lr_biochem_02042026', 'p_001', 'svc_biochem', 'BIOCHEM', '2026-04-02', 'final', NULL),
  ('lr_biochem_25042026', 'p_001', 'svc_biochem', 'BIOCHEM', '2026-04-25', 'final', NULL),
  ('lr_lipid_10012026', 'p_001', 'svc_lipid', 'LIPID', '2026-01-10', 'final', NULL),
  ('lr_lipid_07022026', 'p_001', 'svc_lipid', 'LIPID', '2026-02-07', 'final', NULL),
  ('lr_lipid_02032026', 'p_001', 'svc_lipid', 'LIPID', '2026-03-02', 'final', NULL),
  ('lr_lipid_02042026', 'p_001', 'svc_lipid', 'LIPID', '2026-04-02', 'final', NULL),
  ('lr_lipid_25042026', 'p_001', 'svc_lipid', 'LIPID', '2026-04-25', 'final', NULL),
  ('lr_cbc_10012026', 'p_001', 'svc_cbc', 'CBC', '2026-01-10', 'final', NULL),
  ('lr_cbc_07022026', 'p_001', 'svc_cbc', 'CBC', '2026-02-07', 'final', NULL),
  ('lr_cbc_02032026', 'p_001', 'svc_cbc', 'CBC', '2026-03-02', 'final', NULL),
  ('lr_cbc_02042026', 'p_001', 'svc_cbc', 'CBC', '2026-04-02', 'final', NULL),
  ('lr_cbc_18042026', 'p_001', 'svc_cbc', 'CBC', '2026-04-18', 'final', NULL),
  ('lr_inflam_10012026', 'p_001', 'svc_inflam', 'INFLAM', '2026-01-10', 'final', NULL),
  ('lr_inflam_07022026', 'p_001', 'svc_inflam', 'INFLAM', '2026-02-07', 'final', NULL),
  ('lr_inflam_02032026', 'p_001', 'svc_inflam', 'INFLAM', '2026-03-02', 'final', NULL),
  ('lr_inflam_02042026', 'p_001', 'svc_inflam', 'INFLAM', '2026-04-02', 'final', NULL),
  ('lr_inflam_18042026', 'p_001', 'svc_inflam', 'INFLAM', '2026-04-18', 'final', NULL),
  ('lr_inflam_25042026', 'p_001', 'svc_inflam', 'INFLAM', '2026-04-25', 'final', NULL),
  ('lr_coag_10012026', 'p_001', 'svc_coag', 'COAG', '2026-01-10', 'final', NULL),
  ('lr_coag_07022026', 'p_001', 'svc_coag', 'COAG', '2026-02-07', 'final', NULL),
  ('lr_coag_02032026', 'p_001', 'svc_coag', 'COAG', '2026-03-02', 'final', NULL),
  ('lr_coag_02042026', 'p_001', 'svc_coag', 'COAG', '2026-04-02', 'final', NULL),
  ('lr_coag_12042026', 'p_001', 'svc_coag', 'COAG', '2026-04-12', 'final', NULL),
  ('lr_hormones_10012026', 'p_001', 'svc_hormones', 'HORMONES', '2026-01-10', 'final', NULL),
  ('lr_hormones_07022026', 'p_001', 'svc_hormones', 'HORMONES', '2026-02-07', 'final', NULL),
  ('lr_hormones_02032026', 'p_001', 'svc_hormones', 'HORMONES', '2026-03-02', 'final', NULL),
  ('lr_hormones_02042026', 'p_001', 'svc_hormones', 'HORMONES', '2026-04-02', 'final', NULL),
  ('lr_hormones_10042026', 'p_001', 'svc_hormones', 'HORMONES', '2026-04-10', 'final', NULL)
ON DUPLICATE KEY UPDATE id=VALUES(id), patient_id=VALUES(patient_id), service_id=VALUES(service_id), source_service_code=VALUES(source_service_code), report_date=VALUES(report_date), status=VALUES(status), raw_payload_json=VALUES(raw_payload_json);

INSERT INTO lab_observations (report_id, test_id, source_test_code, value_num, value_text, mapping_status) VALUES
  ('lr_biochem_10012026', 'test_glu', 'GLU', 5.1, NULL, 'mapped'),
  ('lr_biochem_10012026', 'test_hba1c', 'HBA1C', 5.3, NULL, 'mapped'),
  ('lr_biochem_10012026', 'test_crea', 'CREA', 84, NULL, 'mapped'),
  ('lr_biochem_10012026', 'test_alt', 'ALT', 28, NULL, 'mapped'),
  ('lr_biochem_10012026', 'test_ast', 'AST', 25, NULL, 'mapped'),
  ('lr_biochem_07022026', 'test_glu', 'GLU', 5.3, NULL, 'mapped'),
  ('lr_biochem_07022026', 'test_hba1c', 'HBA1C', 5.4, NULL, 'mapped'),
  ('lr_biochem_07022026', 'test_crea', 'CREA', 86, NULL, 'mapped'),
  ('lr_biochem_07022026', 'test_alt', 'ALT', 30, NULL, 'mapped'),
  ('lr_biochem_07022026', 'test_ast', 'AST', 27, NULL, 'mapped'),
  ('lr_biochem_02032026', 'test_glu', 'GLU', 5.7, NULL, 'mapped'),
  ('lr_biochem_02032026', 'test_hba1c', 'HBA1C', 5.5, NULL, 'mapped'),
  ('lr_biochem_02032026', 'test_crea', 'CREA', 85, NULL, 'mapped'),
  ('lr_biochem_02032026', 'test_alt', 'ALT', 31, NULL, 'mapped'),
  ('lr_biochem_02032026', 'test_ast', 'AST', 29, NULL, 'mapped'),
  ('lr_biochem_02042026', 'test_glu', 'GLU', 5.9, NULL, 'mapped'),
  ('lr_biochem_02042026', 'test_hba1c', 'HBA1C', 5.6, NULL, 'mapped'),
  ('lr_biochem_02042026', 'test_crea', 'CREA', 89, NULL, 'mapped'),
  ('lr_biochem_02042026', 'test_alt', 'ALT', 33, NULL, 'mapped'),
  ('lr_biochem_02042026', 'test_ast', 'AST', 28, NULL, 'mapped'),
  ('lr_biochem_25042026', 'test_glu', 'GLU', 6.2, NULL, 'mapped'),
  ('lr_biochem_25042026', 'test_hba1c', 'HBA1C', 5.7, NULL, 'mapped'),
  ('lr_biochem_25042026', 'test_crea', 'CREA', 88, NULL, 'mapped'),
  ('lr_biochem_25042026', 'test_alt', 'ALT', 32, NULL, 'mapped'),
  ('lr_biochem_25042026', 'test_ast', 'AST', 27, NULL, 'mapped'),
  ('lr_lipid_10012026', 'test_chol', 'CHOL', 5, NULL, 'mapped'),
  ('lr_lipid_10012026', 'test_ldl', 'LDL', 2.9, NULL, 'mapped'),
  ('lr_lipid_10012026', 'test_hdl', 'HDL', 1.1, NULL, 'mapped'),
  ('lr_lipid_10012026', 'test_tg', 'TG', 1.4, NULL, 'mapped'),
  ('lr_lipid_07022026', 'test_chol', 'CHOL', 5.1, NULL, 'mapped'),
  ('lr_lipid_07022026', 'test_ldl', 'LDL', 3, NULL, 'mapped'),
  ('lr_lipid_07022026', 'test_hdl', 'HDL', 1.1, NULL, 'mapped'),
  ('lr_lipid_07022026', 'test_tg', 'TG', 1.5, NULL, 'mapped'),
  ('lr_lipid_02032026', 'test_chol', 'CHOL', 5.4, NULL, 'mapped'),
  ('lr_lipid_02032026', 'test_ldl', 'LDL', 3.2, NULL, 'mapped'),
  ('lr_lipid_02032026', 'test_hdl', 'HDL', 1.2, NULL, 'mapped'),
  ('lr_lipid_02032026', 'test_tg', 'TG', 1.7, NULL, 'mapped'),
  ('lr_lipid_02042026', 'test_chol', 'CHOL', 5.6, NULL, 'mapped'),
  ('lr_lipid_02042026', 'test_ldl', 'LDL', 3.4, NULL, 'mapped'),
  ('lr_lipid_02042026', 'test_hdl', 'HDL', 1.2, NULL, 'mapped'),
  ('lr_lipid_02042026', 'test_tg', 'TG', 1.5, NULL, 'mapped'),
  ('lr_lipid_25042026', 'test_chol', 'CHOL', 5.8, NULL, 'mapped'),
  ('lr_lipid_25042026', 'test_ldl', 'LDL', 3.6, NULL, 'mapped'),
  ('lr_lipid_25042026', 'test_hdl', 'HDL', 1.2, NULL, 'mapped'),
  ('lr_lipid_25042026', 'test_tg', 'TG', 1.6, NULL, 'mapped'),
  ('lr_cbc_10012026', 'test_hgb', 'HGB', 141, NULL, 'mapped'),
  ('lr_cbc_10012026', 'test_wbc', 'WBC', 5.7, NULL, 'mapped'),
  ('lr_cbc_10012026', 'test_plt', 'PLT', 240, NULL, 'mapped'),
  ('lr_cbc_07022026', 'test_hgb', 'HGB', 139, NULL, 'mapped'),
  ('lr_cbc_07022026', 'test_wbc', 'WBC', 6, NULL, 'mapped'),
  ('lr_cbc_07022026', 'test_plt', 'PLT', 251, NULL, 'mapped'),
  ('lr_cbc_02032026', 'test_hgb', 'HGB', 142, NULL, 'mapped'),
  ('lr_cbc_02032026', 'test_wbc', 'WBC', 5.9, NULL, 'mapped'),
  ('lr_cbc_02032026', 'test_plt', 'PLT', 260, NULL, 'mapped'),
  ('lr_cbc_02042026', 'test_hgb', 'HGB', 143, NULL, 'mapped'),
  ('lr_cbc_02042026', 'test_wbc', 'WBC', 6.3, NULL, 'mapped'),
  ('lr_cbc_02042026', 'test_plt', 'PLT', 248, NULL, 'mapped'),
  ('lr_cbc_18042026', 'test_hgb', 'HGB', 144, NULL, 'mapped'),
  ('lr_cbc_18042026', 'test_wbc', 'WBC', 6.1, NULL, 'mapped'),
  ('lr_cbc_18042026', 'test_plt', 'PLT', 256, NULL, 'mapped'),
  ('lr_inflam_10012026', 'test_esr', 'ESR', 10, NULL, 'mapped'),
  ('lr_inflam_10012026', 'test_crp', 'CRP', 2.1, NULL, 'mapped'),
  ('lr_inflam_07022026', 'test_esr', 'ESR', 11, NULL, 'mapped'),
  ('lr_inflam_07022026', 'test_crp', 'CRP', 2.6, NULL, 'mapped'),
  ('lr_inflam_02032026', 'test_esr', 'ESR', 13, NULL, 'mapped'),
  ('lr_inflam_02032026', 'test_crp', 'CRP', 3.8, NULL, 'mapped'),
  ('lr_inflam_02042026', 'test_esr', 'ESR', 12, NULL, 'mapped'),
  ('lr_inflam_02042026', 'test_crp', 'CRP', 5.2, NULL, 'mapped'),
  ('lr_inflam_18042026', 'test_esr', 'ESR', 12, NULL, 'mapped'),
  ('lr_inflam_25042026', 'test_crp', 'CRP', 6.8, NULL, 'mapped'),
  ('lr_coag_10012026', 'test_inr', 'INR', 1, NULL, 'mapped'),
  ('lr_coag_10012026', 'test_fib', 'FIB', 2.9, NULL, 'mapped'),
  ('lr_coag_07022026', 'test_inr', 'INR', 1.02, NULL, 'mapped'),
  ('lr_coag_07022026', 'test_fib', 'FIB', 3, NULL, 'mapped'),
  ('lr_coag_02032026', 'test_inr', 'INR', 1.03, NULL, 'mapped'),
  ('lr_coag_02032026', 'test_fib', 'FIB', 3.2, NULL, 'mapped'),
  ('lr_coag_02042026', 'test_inr', 'INR', 1.01, NULL, 'mapped'),
  ('lr_coag_02042026', 'test_fib', 'FIB', 3.1, NULL, 'mapped'),
  ('lr_coag_12042026', 'test_inr', 'INR', 1.04, NULL, 'mapped'),
  ('lr_coag_12042026', 'test_fib', 'FIB', 3.1, NULL, 'mapped'),
  ('lr_hormones_10012026', 'test_tsh', 'TSH', 2.5, NULL, 'mapped'),
  ('lr_hormones_10012026', 'test_vitd', 'VITD', 18, NULL, 'mapped'),
  ('lr_hormones_07022026', 'test_tsh', 'TSH', 2.4, NULL, 'mapped'),
  ('lr_hormones_07022026', 'test_vitd', 'VITD', 19, NULL, 'mapped'),
  ('lr_hormones_02032026', 'test_tsh', 'TSH', 2.2, NULL, 'mapped'),
  ('lr_hormones_02032026', 'test_vitd', 'VITD', 20, NULL, 'mapped'),
  ('lr_hormones_02042026', 'test_tsh', 'TSH', 2, NULL, 'mapped'),
  ('lr_hormones_02042026', 'test_vitd', 'VITD', 21, NULL, 'mapped'),
  ('lr_hormones_10042026', 'test_tsh', 'TSH', 2.1, NULL, 'mapped'),
  ('lr_hormones_10042026', 'test_vitd', 'VITD', 22, NULL, 'mapped')
ON DUPLICATE KEY UPDATE report_id=VALUES(report_id), test_id=VALUES(test_id), source_test_code=VALUES(source_test_code), value_num=VALUES(value_num), value_text=VALUES(value_text), mapping_status=VALUES(mapping_status);

INSERT INTO lab_report_documents (id, lab_report_id, patient_id, storage_key, source_filename, content_type, file_size, checksum_sha256, signature_status) VALUES
  ('lrd_biochem_25042026', 'lr_biochem_25042026', 'p_001', 'alexey/lr_biochem_25042026.pdf', 'biohimia_25042026_original_lab_blank.pdf', 'application/pdf', 1023, 'eb1dc7005b735cba80c6bc8bfa866c45f0492638d14fcf5e44d78007b3a2bda0', 'original_lab_pdf')
ON DUPLICATE KEY UPDATE id=VALUES(id), lab_report_id=VALUES(lab_report_id), patient_id=VALUES(patient_id), storage_key=VALUES(storage_key), source_filename=VALUES(source_filename), content_type=VALUES(content_type), file_size=VALUES(file_size), checksum_sha256=VALUES(checksum_sha256), signature_status=VALUES(signature_status);

INSERT INTO visits (id, visit_date, visit_time, specialty, doctor, room, status, note) VALUES
  ('v_1', '2026-04-26', '11:30', 'Терапевт', 'Иванова Мария Сергеевна', '214', 'Запланировано', 'Обсуждение результатов лабораторных исследований.'),
  ('v_2', '2026-04-22', '15:00', 'Кардиолог', 'Кузнецов Андрей Олегович', '305', 'Завершено', 'АД стабильное. Рекомендован контроль липидов.'),
  ('v_3', '2026-04-10', '09:45', 'Эндокринолог', 'Соколова Елена Викторовна', '118', 'Завершено', 'Назначен HbA1c и повтор глюкозы.')
ON DUPLICATE KEY UPDATE id=VALUES(id), visit_date=VALUES(visit_date), visit_time=VALUES(visit_time), specialty=VALUES(specialty), doctor=VALUES(doctor), room=VALUES(room), status=VALUES(status), note=VALUES(note);

INSERT INTO medical_reports (id, report_date, title, doctor, status, text) VALUES
  ('r_1', '2026-04-24', 'Заключение терапевта', 'Иванова М.С.', 'Новое', 'Рекомендован контроль глюкозы натощак, коррекция питания, повторный липидный профиль через 8–12 недель.'),
  ('r_2', '2026-04-22', 'Заключение кардиолога', 'Кузнецов А.О.', 'Подписано', 'Данных за острый коронарный синдром нет. Рекомендован контроль АД и липидного профиля.'),
  ('r_3', '2026-04-10', 'Заключение эндокринолога', 'Соколова Е.В.', 'Подписано', 'Пограничное повышение глюкозы. Диагноз по одному анализу не устанавливается.')
ON DUPLICATE KEY UPDATE id=VALUES(id), report_date=VALUES(report_date), title=VALUES(title), doctor=VALUES(doctor), status=VALUES(status), text=VALUES(text);

INSERT INTO documents (id, title, document_date, type, size, icon) VALUES
  ('d_1', 'Биохимия крови', '2026-04-25', 'PDF', '146 КБ', '◌'),
  ('d_2', 'Заключение терапевта', '2026-04-24', 'PDF', '118 КБ', '□'),
  ('d_3', 'ЭКГ', '2026-04-22', 'PDF', '204 КБ', '⌁'),
  ('d_4', 'ОАК', '2026-04-18', 'PDF', '96 КБ', '◌')
ON DUPLICATE KEY UPDATE id=VALUES(id), title=VALUES(title), document_date=VALUES(document_date), type=VALUES(type), size=VALUES(size), icon=VALUES(icon);

INSERT INTO events (icon, kind, level, title, text, event_date) VALUES
  ('◌', 'lab', 'warn', 'Готовы результаты биохимии', 'Глюкоза, ЛПНП и общий холестерин выше референса.', 'Сегодня, 09:10'),
  ('＋', 'appointment', 'info', 'Доступна запись к терапевту', 'Есть свободные слоты на ближайшие 3 дня.', 'Сегодня, 08:30'),
  ('□', 'report', 'info', 'Новое заключение терапевта', 'Добавлены рекомендации по контролю липидного профиля.', 'Вчера, 17:35'),
  ('⌘', 'visit', 'ok', 'Прием у кардиолога завершен', 'Следующий контроль через 3 месяца.', '22.04.2026'),
  ('⇣', 'sync', 'purple', 'Синхронизация демо-БД', 'Импортировано 18 лабораторных наблюдений.', '25.04.2026')
ON DUPLICATE KEY UPDATE icon=VALUES(icon), kind=VALUES(kind), level=VALUES(level), title=VALUES(title), text=VALUES(text), event_date=VALUES(event_date);

INSERT INTO sync_jobs (source_system, job_type, status, started_at, finished_at, imported_count, error_count) VALUES ('demo', 'seed', 'success', NOW(), NOW(), 90, 0);
