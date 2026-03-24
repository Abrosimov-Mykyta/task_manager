const KEY = "tm_calendar_settings_v2";

export function loadCalendarSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { startMinutes: 8 * 60, endMinutes: 22 * 60, stepMinutes: 60 };
    const parsed = JSON.parse(raw);
    // v1 fallback (hours only)
    if (typeof parsed.startHour === "number" || typeof parsed.endHour === "number") {
      const startHour = clampInt(parsed.startHour, 0, 23, 8);
      const endHour = clampInt(parsed.endHour, 1, 24, 22);
      const stepMinutes = [15, 30, 60].includes(parsed.stepMinutes) ? parsed.stepMinutes : 60;
      return normalize({
        startMinutes: startHour * 60,
        endMinutes: endHour * 60,
        stepMinutes,
      });
    }

    const startMinutes = clampInt(parsed.startMinutes, 0, 23 * 60 + 45, 8 * 60);
    const endMinutes = clampInt(parsed.endMinutes, 60, 24 * 60, 22 * 60);
    const stepMinutes = [15, 30, 60].includes(parsed.stepMinutes) ? parsed.stepMinutes : 60;
    return normalize({ startMinutes, endMinutes, stepMinutes });
  } catch {
    return { startMinutes: 8 * 60, endMinutes: 22 * 60, stepMinutes: 60 };
  }
}

export function saveCalendarSettings(next) {
  localStorage.setItem(KEY, JSON.stringify(normalize(next)));
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}

function normalize(s) {
  let startMinutes = clampInt(s.startMinutes, 0, 23 * 60 + 45, 8 * 60);
  let endMinutes = clampInt(s.endMinutes, 60, 24 * 60, 22 * 60);
  if (endMinutes <= startMinutes) endMinutes = Math.min(24 * 60, startMinutes + 60);
  const stepMinutes = [15, 30, 60].includes(s.stepMinutes) ? s.stepMinutes : 60;
  // snap start/end to step grid
  startMinutes = Math.floor(startMinutes / stepMinutes) * stepMinutes;
  endMinutes = Math.ceil(endMinutes / stepMinutes) * stepMinutes;
  if (endMinutes <= startMinutes) endMinutes = startMinutes + stepMinutes;
  return { startMinutes, endMinutes, stepMinutes };
}

