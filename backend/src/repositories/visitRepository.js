const { readJson, writeJson } = require("../db/jsonStore");
const { withMysql } = require("./repositoryMode");
const { ruDateToMysql, toRuDate } = require("./formatters");

function mapVisit(row) {
  return {
    id: row.id,
    date: toRuDate(row.visit_date),
    time: row.visit_time,
    specialty: row.specialty,
    doctor: row.doctor,
    room: row.room,
    status: row.status,
    note: row.note
  };
}

async function getVisits(patientId) {
  return withMysql(async (pool) => {
    const [rows] = await pool.query("SELECT * FROM visits ORDER BY visit_date DESC, visit_time DESC");
    return rows.map(mapVisit);
  }, () => readJson("visits"));
}

async function addVisit(visit, patientId) {
  return withMysql(async (pool) => {
    await pool.query(
      "INSERT INTO visits (id, visit_date, visit_time, specialty, doctor, room, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [visit.id, ruDateToMysql(visit.date), visit.time, visit.specialty, visit.doctor, visit.room, visit.status, visit.note]
    );
    return visit;
  }, () => {
    const visits = readJson("visits");
    visits.unshift(visit);
    writeJson("visits", visits);
    return visit;
  });
}

module.exports = { getVisits, addVisit };
