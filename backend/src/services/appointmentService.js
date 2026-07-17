const appointmentRepository = require("../repositories/appointmentRepository");
const visitRepository = require("../repositories/visitRepository");
const integrationRepository = require("../repositories/integrationRepository");
const demoPatients = require("../data/demoPatients");
const { storagePatientId } = require("../utils/demoPatientContext");

async function getVisits(patientId) {
  if (demoPatients.isSyntheticPatient(patientId)) return demoPatients.getVisits(patientId);
  return visitRepository.getVisits(storagePatientId(patientId));
}

async function getBookingDictionary() {
  return appointmentRepository.getBookingDictionary();
}

async function bookAppointment(payload, patientId) {
  const { doctors } = await getBookingDictionary();
  const doctor = doctors.find((item) => item.id === payload.doctorId);
  if (!doctor) {
    const error = new Error("doctor_not_found");
    error.statusCode = 400;
    throw error;
  }

  const resultContext = payload.resultContext;
  const resultText = resultContext?.test_name
    ? `Обсудить результат: ${resultContext.test_name} ${resultContext.value ?? ""} ${resultContext.unit || ""}.`.replace(/\s+/g, " ").trim()
    : "Запись создана через Атлас здоровья.";

  const visit = {
    id: `v_${Date.now()}`,
    date: payload.date && payload.date.length <= 5 ? `${payload.date}.2026` : payload.date,
    time: payload.slot || payload.time,
    specialty: doctor.role,
    doctor: doctor.name,
    room: doctor.room,
    status: "Запланировано",
    note: resultText
  };

  if (!visit.date || !visit.time) {
    const error = new Error("missing_date_or_time");
    error.statusCode = 400;
    throw error;
  }

  if (demoPatients.isSyntheticPatient(patientId)) {
    demoPatients.addVisit(patientId, visit);
  } else {
    await visitRepository.addVisit(visit, storagePatientId(patientId));
    await appointmentRepository.createAppointment(payload, visit);
    await integrationRepository.addEvent({
      icon: "＋",
      kind: "appointment",
      level: "info",
      title: "Создана новая запись",
      text: `${visit.specialty}: ${visit.doctor}, ${visit.date} в ${visit.time}. ${resultText}`,
      date: "Только что"
    });
    await integrationRepository.touchSync("appointment_book", 1, 0);
  }

  return visit;
}

module.exports = { getVisits, getBookingDictionary, bookAppointment };
