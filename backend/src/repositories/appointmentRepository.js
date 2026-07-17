const { readJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");
const { ruDateToMysql } = require("./formatters");

async function getBookingDictionary() {
  return {
    specialties: readJson("specialties"),
    doctors: readJson("doctors"),
    slots: readJson("slots")
  };
}

async function createAppointment(payload, visit) {
  return withMysql(async (pool) => {
    await pool.query(
      "INSERT INTO appointments (id, specialty, doctor_id, doctor, appointment_date, appointment_time, status, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        `a_${Date.now()}`,
        visit.specialty,
        payload.doctorId,
        visit.doctor,
        ruDateToMysql(visit.date),
        visit.time,
        "created",
        JSON.stringify(payload)
      ]
    );
    return visit;
  }, () => visit);
}

module.exports = { getBookingDictionary, createAppointment };
