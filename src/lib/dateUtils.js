/** YYYY-MM-DD */
export function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, days) {
  const d = typeof dateStr === "string" ? parseYMD(dateStr) : new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

/** Monday of the week for the given date (or string YYYY-MM-DD) */
export function getMonday(dateOrStr) {
  const d = typeof dateOrStr === "string" ? parseYMD(dateOrStr) : new Date(dateOrStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
}

export function getTodayYMD() {
  return toYMD(new Date());
}

/** Format for display: d.m (e.g. 11.03) */
export function formatDayShort(dateStr) {
  const d = typeof dateStr === "string" ? parseYMD(dateStr) : dateStr;
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${day}.${String(month).padStart(2, "0")}`;
}

const MONTHS_UA = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getUiLanguage() {
  try {
    const attr = document?.documentElement?.getAttribute("data-language");
    if (attr === "en") return "en";
  } catch {}
  return "uk";
}

export function getMonthName(dateStr) {
  const d = typeof dateStr === "string" ? parseYMD(dateStr) : dateStr;
  return (getUiLanguage() === "en" ? MONTHS_EN : MONTHS_UA)[d.getMonth()];
}

export function getMonthYear(dateStr) {
  const d = typeof dateStr === "string" ? parseYMD(dateStr) : dateStr;
  const month = (getUiLanguage() === "en" ? MONTHS_EN : MONTHS_UA)[d.getMonth()];
  return `${month} ${d.getFullYear()}`;
}

/** First day of month (YYYY-MM-DD) */
export function getMonthStart(dateStr) {
  const d = typeof dateStr === "string" ? parseYMD(dateStr) : new Date(dateStr);
  d.setDate(1);
  return toYMD(d);
}

/** Last day of month (YYYY-MM-DD) */
export function getMonthEnd(dateStr) {
  const d = typeof dateStr === "string" ? parseYMD(dateStr) : new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toYMD(d);
}

/** Number of days in month */
export function getDaysInMonth(dateStr) {
  const start = parseYMD(getMonthStart(dateStr));
  const end = parseYMD(getMonthEnd(dateStr));
  return (end - start) / 86400000 + 1;
}
