window.HealthAPI = (() => {
  const delay = (value, ms = 120) => new Promise(resolve => setTimeout(() => resolve(value), ms));

  function enrichLab(db) {
    const byCode = Object.fromEntries(db.labCatalog.map(item => [item.code, item]));
    const grouped = {};
    db.labObservations.forEach(obs => {
      if (!grouped[obs.code]) grouped[obs.code] = [];
      grouped[obs.code].push(obs);
    });

    return Object.entries(grouped).map(([code, history]) => {
      const meta = byCode[code];
      history.sort((a, b) => parseDate(a.date) - parseDate(b.date));
      const latest = history[history.length - 1];
      const flag = latest.value > meta.high ? "high" : latest.value < meta.low ? "low" : "normal";
      return {
        ...meta,
        latestValue: latest.value,
        latestDate: latest.date,
        flag,
        history: history.map(item => ({ date: item.date, value: item.value })),
        interpretation: buildInterpretation(meta, latest.value, flag)
      };
    });
  }

  function parseDate(date) {
    const [d, m, y] = date.split(".").map(Number);
    return new Date(y, m - 1, d);
  }

  function buildInterpretation(meta, value, flag) {
    if (flag === "normal") return `${meta.name}: значение находится в пределах референсного интервала. Динамика доступна на графике.`;
    if (flag === "high") return `${meta.name}: значение выше референсного интервала. Это не диагноз; результат нужно интерпретировать с врачом и клиническим контекстом.`;
    return `${meta.name}: значение ниже референсного интервала. Рекомендуется обсудить результат с врачом.`;
  }

  function summary() {
    const db = HealthStore.get();
    const labs = enrichLab(db);
    const abnormal = labs.filter(x => x.flag !== "normal");
    return delay({
      patient: db.patient,
      meta: db.meta,
      labs,
      abnormal,
      events: db.events,
      visits: db.visits,
      reports: db.reports
    });
  }

  function labs() {
    const db = HealthStore.get();
    return delay({
      groups: db.labGroups,
      catalog: db.labCatalog,
      labs: enrichLab(db)
    });
  }

  function labHistory() {
    const db = HealthStore.get();
    const byCode = Object.fromEntries(db.labCatalog.map(item => [item.code, item]));
    const rows = db.labObservations.map(obs => {
      const meta = byCode[obs.code];
      const flag = obs.value > meta.high ? "high" : obs.value < meta.low ? "low" : "normal";
      return { ...obs, ...meta, flag };
    }).sort((a, b) => parseDate(b.date) - parseDate(a.date));
    return delay(rows);
  }

  function visits() {
    return delay(HealthStore.get().visits);
  }

  function reports() {
    const db = HealthStore.get();
    return delay({ reports: db.reports, docs: db.docs });
  }

  function bookingData() {
    const db = HealthStore.get();
    return delay({ specialties: db.specialties, doctors: db.doctors, slots: db.slots });
  }

  function bookAppointment(payload) {
    return delay(HealthStore.update(db => {
      const doctor = db.doctors.find(x => x.id === payload.doctorId);
      const visit = {
        id: `v_${Date.now()}`,
        date: `${payload.date}.2026`,
        time: payload.slot,
        specialty: doctor.role,
        doctor: doctor.name,
        room: doctor.room,
        status: "Запланировано",
        note: "Запись создана в демо-МVP. В production уйдет POST /api/appointments/book."
      };
      db.visits.unshift(visit);
      db.events.unshift({
        icon: "＋",
        kind: "appointment",
        level: "info",
        title: "Создана новая запись",
        text: `${visit.specialty}: ${visit.doctor}, ${visit.date} в ${visit.time}.`,
        date: "Только что"
      });
      db.meta.lastSync = new Date().toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    }));
  }

  function importLabObservations(items) {
    return delay(HealthStore.update(db => {
      const validCodes = new Set(db.labCatalog.map(x => x.code));
      const normalized = items
        .filter(item => item.code && validCodes.has(item.code) && !Number.isNaN(Number(item.value)) && item.date)
        .map(item => ({ code: item.code, value: Number(item.value), date: item.date }));
      db.labObservations.push(...normalized);
      db.events.unshift({
        icon: "⇣",
        kind: "sync",
        level: "purple",
        title: "Импортированы лабораторные данные",
        text: `Добавлено ${normalized.length} наблюдений из JSON/CSV.`,
        date: "Только что"
      });
      db.meta.lastSync = new Date().toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    }));
  }

  function reset() {
    HealthStore.reset();
    return delay(HealthStore.get());
  }

  return { summary, labs, labHistory, visits, reports, bookingData, bookAppointment, importLabObservations, reset };
})();
