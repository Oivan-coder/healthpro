window.Pages = window.Pages || {};

window.BookingState = {
  specialtyId: "therapy",
  doctorId: "doc_1",
  date: "26.04",
  slot: "11:30"
};

window.Pages.appointments = async function renderAppointments() {
  const data = await HealthAPI.bookingData();
  const doctors = data.doctors.filter(d => d.specialtyId === BookingState.specialtyId);
  if (!doctors.find(d => d.id === BookingState.doctorId)) BookingState.doctorId = doctors[0]?.id;
  const doctor = data.doctors.find(d => d.id === BookingState.doctorId) || data.doctors[0];
  const context = BookingState.resultContext;

  UI.root().innerHTML = `
    <section class="appointment-intro feed-card">
      <div>
        <div class="label">Рекомендуемый следующий шаг</div>
        <h2>${context ? "Обсудить выбранный показатель" : "Обсудить показатели, которые требуют внимания"}</h2>
        <p class="muted">${context
          ? "Запись сохранит повод приема, чтобы на консультации было проще вернуться к результату."
          : "Можно выбрать врача и время, чтобы спокойно разобрать анализы, динамику и подготовленные вопросы."}</p>
      </div>
      <button class="btn secondary" data-route-action="labs" data-lab-mode="abnormal">К показателям</button>
    </section>

    ${context ? `
      <section class="appointment-context next-step-card">
        <div class="label">Повод для записи</div>
        <h2>Обсудить результат с врачом</h2>
        <p>Вы записываетесь, чтобы обсудить результат: <b>${context.test_name}</b> ${context.value} ${context.unit || ""}.</p>
        <p class="muted">Это не диагноз. Врач поможет интерпретировать результат с учетом жалоб, подготовки и лекарств.</p>
        <div class="tile-grid">
          <div class="tile"><span class="label">Дата результата</span><b>${context.report_date || "не указана"}</b></div>
          <div class="tile"><span class="label">Показатель</span><b>${context.test_name}</b></div>
          <div class="tile"><span class="label">Рекомендуемый маршрут</span><b>${context.suggestedSpecialty}</b></div>
        </div>
      </section>
    ` : ""}

    <section class="appointment-layout patient-flow">
      <div class="feed-card flow-step">
        <div class="label">Шаг 1</div>
        <h2>Специализация</h2>
        <div class="list">
          ${data.specialties.map(s => `
            <button class="select-card ${s.id===BookingState.specialtyId ? "active":""}" data-specialty="${s.id}">
              <div class="icon-bubble">${s.icon}</div>
              <h3>${s.name}</h3>
              <p class="muted">${s.description}</p>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="feed-card flow-step">
        <div class="label">Шаг 2</div>
        <h2>Врач</h2>
        <div class="list">
          ${doctors.map(d => `
            <button class="select-card doctor-card ${d.id===BookingState.doctorId ? "active":""}" data-doctor="${d.id}">
              <div class="doctor-avatar">${d.initials}</div>
              <div>
                <b>${d.name}</b>
                <div class="muted">${d.role} • стаж ${d.experience}</div>
                <small class="muted">★ ${d.rating} • каб. ${d.room}</small>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="feed-card flow-step">
        <div class="label">Шаг 3</div>
        <h2>Дата и время</h2>
        <p><b>${doctor.name}</b></p>
        <p class="muted">${doctor.role} • кабинет ${doctor.room}</p>

        <div class="date-strip appointment-date-strip">
          ${Object.keys(data.slots).map(date => `
            <button class="date-btn ${date===BookingState.date ? "active":""}" data-date="${date}">
              ${date}<br><small>апр</small>
            </button>
          `).join("")}
        </div>

        <div class="slot-grid">
          ${data.slots[BookingState.date].map(slot => `
            <button class="slot-btn ${slot===BookingState.slot ? "active":""}" data-slot="${slot}">${slot}</button>
          `).join("")}
        </div>

        <div class="interpretation appointment-result" style="margin-top:16px">
          <b>Итог записи</b>
          <p class="muted">${doctor.role}, ${doctor.name}. ${BookingState.date}.2026 в ${BookingState.slot}, кабинет ${doctor.room}.${context ? ` Повод: обсудить результат “${context.test_name}”.` : ""}</p>
          <button class="btn primary wide" id="bookBtn">Записаться</button>
        </div>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-specialty]").forEach(btn => btn.onclick = () => {
    BookingState.specialtyId = btn.dataset.specialty;
    window.App.render();
  });

  document.querySelectorAll("[data-doctor]").forEach(btn => btn.onclick = () => {
    BookingState.doctorId = btn.dataset.doctor;
    window.App.render();
  });

  document.querySelectorAll("[data-date]").forEach(btn => btn.onclick = () => {
    BookingState.date = btn.dataset.date;
    BookingState.slot = data.slots[BookingState.date][0];
    window.App.render();
  });

  document.querySelectorAll("[data-slot]").forEach(btn => btn.onclick = () => {
    BookingState.slot = btn.dataset.slot;
    window.App.render();
  });

  document.getElementById("bookBtn").onclick = async () => {
    await HealthAPI.bookAppointment({
      doctorId: BookingState.doctorId,
      date: BookingState.date,
      slot: BookingState.slot,
      resultContext: BookingState.resultContext || null
    });
    document.getElementById("bookingResult").innerHTML = `
      <div class="card flat">
        <h3>${doctor.role}</h3>
        <p><b>${doctor.name}</b></p>
        <p class="muted">${BookingState.date}.2026, ${BookingState.slot} • каб. ${doctor.room}</p>
        ${context ? `<p class="muted">Повод: обсудить результат “${context.test_name}”.</p>` : ""}
      </div>
    `;
    UI.openModal("bookingModal");
    UI.toast("Запись создана");
  };
};

window.Pages.visits = async function renderVisits() {
  const visits = await HealthAPI.visits();
  UI.root().innerHTML = `
    <section class="visits-feed">
      <div class="feed-card">
        <div class="label">Врачи</div>
        <h2>Приемы и события</h2>
        <p class="muted">Здесь видны запланированные консультации и прошедшие события, связанные с наблюдением здоровья.</p>
      </div>
      <div class="health-timeline visit-timeline">
        ${visits.map(v => `
          <article class="timeline-item visit-item">
            <div class="timeline-dot ${v.status==="Запланировано" ? "" : "ok"}"></div>
            <div>
              <span class="status ${v.status==="Запланировано" ? "info" : "ok"}">${v.status}</span>
              <h3>${v.specialty}</h3>
              <p><b>${v.doctor}</b></p>
              <p class="muted">${v.date}, ${v.time} • каб. ${v.room}</p>
              <p class="muted">${v.note}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
};
