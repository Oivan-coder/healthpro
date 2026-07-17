function parseRuDate(date) {
  if (!date || typeof date !== "string") return new Date(0);
  const [day, month, year] = date.split(".").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function nowRu() {
  return new Date().toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

module.exports = { parseRuDate, nowRu };
