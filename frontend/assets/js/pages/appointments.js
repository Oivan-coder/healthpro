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

  UI.root().innerHTML = `
    <section class="appointment-layout">
      <div class="card">
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

      <div class="card">
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

      <div class="card">
        <div class="label">Шаг 3</div>
        <h2>Дата и время</h2>
        <p><b>${doctor.name}</b></p>
        <p class="muted">${doctor.role} • кабинет ${doctor.room}</p>

        <div class="date-strip">
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

        <div class="interpretation" style="margin-top:16px">
          <b>Итог записи</b>
          <p class="muted">${doctor.role}, ${doctor.name}. ${BookingState.date}.2026 в ${BookingState.slot}, кабинет ${doctor.room}.</p>
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
    await HealthAPI.bookAppointment({ doctorId: BookingState.doctorId, date: BookingState.date, slot: BookingState.slot });
    document.getElementById("bookingResult").innerHTML = `
      <div class="card flat">
        <h3>${doctor.role}</h3>
        <p><b>${doctor.name}</b></p>
        <p class="muted">${BookingState.date}.2026, ${BookingState.slot} • каб. ${doctor.room}</p>
      </div>
    `;
    UI.openModal("bookingModal");
    UI.toast("Запись создана");
  };
};

window.Pages.visits = async function renderVisits() {
  const visits = await HealthAPI.visits();
  UI.root().innerHTML = `
    <section class="card">
      <div class="label">Приемы</div>
      <h2>Медицинские события</h2>
      <div class="grid-2">
        ${visits.map(v => `
          <article class="card flat">
            <span class="status ${v.status==="Запланировано" ? "info" : "ok"}">${v.status}</span>
            <h3>${v.specialty}</h3>
            <p><b>${v.doctor}</b></p>
            <p class="muted">${v.date}, ${v.time} • каб. ${v.room}</p>
            <p class="muted">${v.note}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
};
