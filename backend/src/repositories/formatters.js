function toRuDate(value) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return value;
    const [year, month, day] = value.slice(0, 10).split("-");
    if (year && month && day) return `${day}.${month}.${year}`;
    return value;
  }
  if (value instanceof Date) {
    return value.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }
  return String(value);
}

function ruDateToMysql(date) {
  if (!date || typeof date !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [day, month, year] = date.split(".");
  if (!day || !month || !year) return date;
  return `${year}-${month}-${day}`;
}

module.exports = { toRuDate, ruDateToMysql };
