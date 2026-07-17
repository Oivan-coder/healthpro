window.HealthMockDB = {
  meta: {
    version: "5.0",
    lastSync: "25.04.2026, 09:42",
    source: "frontend-local-demo",
    pilotScope: {
      patients: "50–200",
      parameters: "30–50",
      contour: "1 МИС/ЛИС",
      ai: "без сложного ИИ на первом этапе"
    }
  },

  patient: {
    id: "p_001",
    misPatientId: "mis_884219",
    misCard: "MIS-248019",
    name: "Алексей Петров",
    initials: "АП",
    phone: "+7 900 123-45-67",
    birthDate: "14.08.1983",
    age: 42,
    sex: "Мужской",
    policy: "ОМС •••• 9381",
    clinic: "Частная клиника «Пилот»",
    region: "Московская область"
  },

  events: [
    { icon: "◌", kind: "lab", level: "warn", title: "Готовы результаты биохимии", text: "Глюкоза, ЛПНП и общий холестерин выше референса.", date: "Сегодня, 09:10" },
    { icon: "＋", kind: "appointment", level: "info", title: "Доступна запись к терапевту", text: "Есть свободные слоты на ближайшие 3 дня.", date: "Сегодня, 08:30" },
    { icon: "□", kind: "report", level: "info", title: "Новое заключение терапевта", text: "Добавлены рекомендации по контролю липидного профиля.", date: "Вчера, 17:35" },
    { icon: "⌘", kind: "visit", level: "ok", title: "Прием у кардиолога завершен", text: "Следующий контроль через 3 месяца.", date: "22.04.2026" },
    { icon: "⇣", kind: "sync", level: "purple", title: "Синхронизация демо-БД", text: "Импортировано 18 лабораторных наблюдений.", date: "25.04.2026" }
  ],

  labGroups: ["Все", "ОАК", "Биохимия", "Липидный профиль", "Коагулограмма", "Гормоны", "Воспаление"],

  labCatalog: [
    { code: "GLU", name: "Глюкоза", group: "Биохимия", unit: "ммоль/л", low: 3.9, high: 5.5, loinc: "2345-7", graphable: true },
    { code: "HBA1C", name: "HbA1c", group: "Биохимия", unit: "%", low: 4.0, high: 5.6, loinc: "4548-4", graphable: true },
    { code: "CREA", name: "Креатинин", group: "Биохимия", unit: "мкмоль/л", low: 62, high: 106, loinc: "2160-0", graphable: true },
    { code: "ALT", name: "АЛТ", group: "Биохимия", unit: "Ед/л", low: 0, high: 41, loinc: "1742-6", graphable: true },
    { code: "AST", name: "АСТ", group: "Биохимия", unit: "Ед/л", low: 0, high: 40, loinc: "1920-8", graphable: true },
    { code: "CHOL", name: "Общий холестерин", group: "Липидный профиль", unit: "ммоль/л", low: 0, high: 5.2, loinc: "2093-3", graphable: true },
    { code: "LDL", name: "ЛПНП", group: "Липидный профиль", unit: "ммоль/л", low: 0, high: 3.0, loinc: "13457-7", graphable: true },
    { code: "HDL", name: "ЛПВП", group: "Липидный профиль", unit: "ммоль/л", low: 1.0, high: 99, loinc: "2085-9", graphable: true },
    { code: "TG", name: "Триглицериды", group: "Липидный профиль", unit: "ммоль/л", low: 0, high: 1.7, loinc: "2571-8", graphable: true },
    { code: "HGB", name: "Гемоглобин", group: "ОАК", unit: "г/л", low: 130, high: 170, loinc: "718-7", graphable: true },
    { code: "WBC", name: "Лейкоциты", group: "ОАК", unit: "10⁹/л", low: 4.0, high: 9.0, loinc: "6690-2", graphable: true },
    { code: "PLT", name: "Тромбоциты", group: "ОАК", unit: "10⁹/л", low: 150, high: 400, loinc: "777-3", graphable: true },
    { code: "ESR", name: "СОЭ", group: "Воспаление", unit: "мм/ч", low: 0, high: 15, loinc: "4537-7", graphable: true },
    { code: "CRP", name: "СРБ", group: "Воспаление", unit: "мг/л", low: 0, high: 5, loinc: "1988-5", graphable: true },
    { code: "INR", name: "МНО", group: "Коагулограмма", unit: "", low: 0.85, high: 1.15, loinc: "6301-6", graphable: true },
    { code: "FIB", name: "Фибриноген", group: "Коагулограмма", unit: "г/л", low: 2.0, high: 4.0, loinc: "3255-7", graphable: true },
    { code: "TSH", name: "ТТГ", group: "Гормоны", unit: "мМЕ/л", low: 0.4, high: 4.0, loinc: "3016-3", graphable: true },
    { code: "VITD", name: "Витамин D", group: "Гормоны", unit: "нг/мл", low: 30, high: 100, loinc: "1989-3", graphable: true }
  ],

  labObservations: [
    { code: "GLU", value: 5.1, date: "10.01.2026" }, { code: "GLU", value: 5.3, date: "07.02.2026" }, { code: "GLU", value: 5.7, date: "02.03.2026" }, { code: "GLU", value: 5.9, date: "02.04.2026" }, { code: "GLU", value: 6.2, date: "25.04.2026" },
    { code: "HBA1C", value: 5.3, date: "10.01.2026" }, { code: "HBA1C", value: 5.4, date: "07.02.2026" }, { code: "HBA1C", value: 5.5, date: "02.03.2026" }, { code: "HBA1C", value: 5.6, date: "02.04.2026" }, { code: "HBA1C", value: 5.7, date: "25.04.2026" },
    { code: "CREA", value: 84, date: "10.01.2026" }, { code: "CREA", value: 86, date: "07.02.2026" }, { code: "CREA", value: 85, date: "02.03.2026" }, { code: "CREA", value: 89, date: "02.04.2026" }, { code: "CREA", value: 88, date: "25.04.2026" },
    { code: "ALT", value: 28, date: "10.01.2026" }, { code: "ALT", value: 30, date: "07.02.2026" }, { code: "ALT", value: 31, date: "02.03.2026" }, { code: "ALT", value: 33, date: "02.04.2026" }, { code: "ALT", value: 32, date: "25.04.2026" },
    { code: "AST", value: 25, date: "10.01.2026" }, { code: "AST", value: 27, date: "07.02.2026" }, { code: "AST", value: 29, date: "02.03.2026" }, { code: "AST", value: 28, date: "02.04.2026" }, { code: "AST", value: 27, date: "25.04.2026" },
    { code: "CHOL", value: 5.0, date: "10.01.2026" }, { code: "CHOL", value: 5.1, date: "07.02.2026" }, { code: "CHOL", value: 5.4, date: "02.03.2026" }, { code: "CHOL", value: 5.6, date: "02.04.2026" }, { code: "CHOL", value: 5.8, date: "25.04.2026" },
    { code: "LDL", value: 2.9, date: "10.01.2026" }, { code: "LDL", value: 3.0, date: "07.02.2026" }, { code: "LDL", value: 3.2, date: "02.03.2026" }, { code: "LDL", value: 3.4, date: "02.04.2026" }, { code: "LDL", value: 3.6, date: "25.04.2026" },
    { code: "HDL", value: 1.1, date: "10.01.2026" }, { code: "HDL", value: 1.1, date: "07.02.2026" }, { code: "HDL", value: 1.2, date: "02.03.2026" }, { code: "HDL", value: 1.2, date: "02.04.2026" }, { code: "HDL", value: 1.2, date: "25.04.2026" },
    { code: "TG", value: 1.4, date: "10.01.2026" }, { code: "TG", value: 1.5, date: "07.02.2026" }, { code: "TG", value: 1.7, date: "02.03.2026" }, { code: "TG", value: 1.5, date: "02.04.2026" }, { code: "TG", value: 1.6, date: "25.04.2026" },
    { code: "HGB", value: 141, date: "10.01.2026" }, { code: "HGB", value: 139, date: "07.02.2026" }, { code: "HGB", value: 142, date: "02.03.2026" }, { code: "HGB", value: 143, date: "02.04.2026" }, { code: "HGB", value: 144, date: "18.04.2026" },
    { code: "WBC", value: 5.7, date: "10.01.2026" }, { code: "WBC", value: 6.0, date: "07.02.2026" }, { code: "WBC", value: 5.9, date: "02.03.2026" }, { code: "WBC", value: 6.3, date: "02.04.2026" }, { code: "WBC", value: 6.1, date: "18.04.2026" },
    { code: "PLT", value: 240, date: "10.01.2026" }, { code: "PLT", value: 251, date: "07.02.2026" }, { code: "PLT", value: 260, date: "02.03.2026" }, { code: "PLT", value: 248, date: "02.04.2026" }, { code: "PLT", value: 256, date: "18.04.2026" },
    { code: "ESR", value: 10, date: "10.01.2026" }, { code: "ESR", value: 11, date: "07.02.2026" }, { code: "ESR", value: 13, date: "02.03.2026" }, { code: "ESR", value: 12, date: "02.04.2026" }, { code: "ESR", value: 12, date: "18.04.2026" },
    { code: "CRP", value: 2.1, date: "10.01.2026" }, { code: "CRP", value: 2.6, date: "07.02.2026" }, { code: "CRP", value: 3.8, date: "02.03.2026" }, { code: "CRP", value: 5.2, date: "02.04.2026" }, { code: "CRP", value: 6.8, date: "25.04.2026" },
    { code: "INR", value: 1.00, date: "10.01.2026" }, { code: "INR", value: 1.02, date: "07.02.2026" }, { code: "INR", value: 1.03, date: "02.03.2026" }, { code: "INR", value: 1.01, date: "02.04.2026" }, { code: "INR", value: 1.04, date: "12.04.2026" },
    { code: "FIB", value: 2.9, date: "10.01.2026" }, { code: "FIB", value: 3.0, date: "07.02.2026" }, { code: "FIB", value: 3.2, date: "02.03.2026" }, { code: "FIB", value: 3.1, date: "02.04.2026" }, { code: "FIB", value: 3.1, date: "12.04.2026" },
    { code: "TSH", value: 2.5, date: "10.01.2026" }, { code: "TSH", value: 2.4, date: "07.02.2026" }, { code: "TSH", value: 2.2, date: "02.03.2026" }, { code: "TSH", value: 2.0, date: "02.04.2026" }, { code: "TSH", value: 2.1, date: "10.04.2026" },
    { code: "VITD", value: 18, date: "10.01.2026" }, { code: "VITD", value: 19, date: "07.02.2026" }, { code: "VITD", value: 20, date: "02.03.2026" }, { code: "VITD", value: 21, date: "02.04.2026" }, { code: "VITD", value: 22, date: "10.04.2026" }
  ],

  visits: [
    { id: "v_1", date: "26.04.2026", time: "11:30", specialty: "Терапевт", doctor: "Иванова Мария Сергеевна", room: "214", status: "Запланировано", note: "Обсуждение результатов лабораторных исследований." },
    { id: "v_2", date: "22.04.2026", time: "15:00", specialty: "Кардиолог", doctor: "Кузнецов Андрей Олегович", room: "305", status: "Завершено", note: "АД стабильное. Рекомендован контроль липидов." },
    { id: "v_3", date: "10.04.2026", time: "09:45", specialty: "Эндокринолог", doctor: "Соколова Елена Викторовна", room: "118", status: "Завершено", note: "Назначен HbA1c и повтор глюкозы." }
  ],

  reports: [
    { id: "r_1", date: "24.04.2026", title: "Заключение терапевта", doctor: "Иванова М.С.", status: "Новое", text: "Рекомендован контроль глюкозы натощак, коррекция питания, повторный липидный профиль через 8–12 недель." },
    { id: "r_2", date: "22.04.2026", title: "Заключение кардиолога", doctor: "Кузнецов А.О.", status: "Подписано", text: "Данных за острый коронарный синдром нет. Рекомендован контроль АД и липидного профиля." },
    { id: "r_3", date: "10.04.2026", title: "Заключение эндокринолога", doctor: "Соколова Е.В.", status: "Подписано", text: "Пограничное повышение глюкозы. Диагноз по одному анализу не устанавливается." }
  ],

  docs: [
    { id: "d_1", title: "Биохимия крови", date: "25.04.2026", type: "PDF", size: "146 КБ", icon: "◌" },
    { id: "d_2", title: "Заключение терапевта", date: "24.04.2026", type: "PDF", size: "118 КБ", icon: "□" },
    { id: "d_3", title: "ЭКГ", date: "22.04.2026", type: "PDF", size: "204 КБ", icon: "⌁" },
    { id: "d_4", title: "ОАК", date: "18.04.2026", type: "PDF", size: "96 КБ", icon: "◌" }
  ],

  specialties: [
    { id: "therapy", name: "Терапевт", icon: "✚", description: "анализы, профилактика, маршрутизация" },
    { id: "cardio", name: "Кардиолог", icon: "♡", description: "АД, ЭКГ, липидный профиль" },
    { id: "endo", name: "Эндокринолог", icon: "◍", description: "глюкоза, ТТГ, витамин D" },
    { id: "lab", name: "Забор крови", icon: "◌", description: "процедурный кабинет" }
  ],

  doctors: [
    { id: "doc_1", specialtyId: "therapy", name: "Иванова Мария Сергеевна", role: "Терапевт", rating: "4.9", experience: "12 лет", room: "214", initials: "МИ" },
    { id: "doc_2", specialtyId: "therapy", name: "Орлова Наталья Николаевна", role: "Терапевт", rating: "4.8", experience: "9 лет", room: "219", initials: "НО" },
    { id: "doc_3", specialtyId: "cardio", name: "Кузнецов Андрей Олегович", role: "Кардиолог", rating: "4.9", experience: "15 лет", room: "305", initials: "АК" },
    { id: "doc_4", specialtyId: "endo", name: "Соколова Елена Викторовна", role: "Эндокринолог", rating: "4.7", experience: "11 лет", room: "118", initials: "ЕС" },
    { id: "doc_5", specialtyId: "lab", name: "Процедурный кабинет", role: "Забор крови", rating: "—", experience: "08:00–12:00", room: "101", initials: "ПК" }
  ],

  slots: {
    "26.04": ["09:00", "10:30", "11:30", "14:00", "16:30"],
    "27.04": ["08:30", "12:00", "13:30", "15:40"],
    "28.04": ["09:20", "10:40", "12:20", "17:00"],
    "29.04": ["08:20", "11:00", "15:10", "18:00"],
    "30.04": ["09:10", "13:20", "16:20"]
  }
};
