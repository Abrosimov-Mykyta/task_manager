export function formatClock(totalMinutes, timeFormat = "24h") {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (timeFormat === "12h") {
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

