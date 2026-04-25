import { useEffect, useMemo, useState } from "react";
import "../App.css";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import CustomSelect from "../components/CustomSelect";
import { useSettings } from "../settings/SettingsProvider";
import { formatClock } from "../lib/formatting";
import {
  getMonday,
  addDays,
  toYMD,
  getTodayYMD,
  formatDayShort,
  getMonthStart,
  getMonthEnd,
  getMonthYear,
  getDaysInMonth,
} from "../lib/dateUtils";

const GROUP_COLORS = [
  "#22c55e",
  "#60a5fa",
  "#f97316",
  "#e879f9",
  "#facc15",
  "#2dd4bf",
];

function minutesToHhMm(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm} min`;
  if (mm === 0) return `${h} h`;
  return `${h} h ${mm} min`;
}

function DonutChart({ data, title, totalLabel, emptyLabel }) {
  const circumference = 2 * Math.PI * 50;
  const total = data.reduce((a, b) => a + b.value, 0);
  if (!data.length || total === 0) {
    return (
      <div className="stats-donut-wrap">
        <div className="stats-donut-title">{title}</div>
        <svg width="260" height="260" viewBox="0 0 120 120">
          <g transform="translate(60,60)">
            <circle r="50" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
            <circle r="32" fill="#020617" />
            <text x="0" y="0" textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.8)">
              {emptyLabel}
            </text>
          </g>
        </svg>
      </div>
    );
  }
  let offset = 0;
  return (
    <div className="stats-donut-wrap">
      <div className="stats-donut-title">{title}</div>
      <svg width="260" height="260" viewBox="0 0 120 120">
        <g transform="translate(60,60)">
          {data.map((p) => {
            const frac = p.value / total;
            const length = circumference * frac;
            const dasharray = `${length} ${circumference - length}`;
            const dashoffset = -offset;
            offset += length;
            return (
              <circle
                key={p.id}
                r="50"
                fill="transparent"
                stroke={p.color}
                strokeWidth="10"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
                transform="rotate(-90)"
              />
            );
          })}
          <circle r="32" fill="#020617" />
          <text x="0" y="-4" textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.9)">
            {totalLabel}
          </text>
          <text x="0" y="8" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#e5e7eb">
            {minutesToHhMm(total)}
          </text>
        </g>
      </svg>
      <div className="stats-legend">
        {data.map((p) => (
          <div key={p.id} className="stats-legend-item">
            <span className="stats-legend-dot" style={{ background: p.color }} />
            <span>{p.label}</span>
            <span className="stats-legend-pct">{((p.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { timeFormat } = useSettings();
  const [groups, setGroups] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeType, setRangeType] = useState("week"); // 'day' | 'week' | 'month'
  const [rangeStart, setRangeStart] = useState(() => getMonday(getTodayYMD()));

  const { from, to, label } = useMemo(() => {
    if (rangeType === "day") {
      return { from: rangeStart, to: rangeStart, label: formatDayShort(rangeStart) };
    }
    if (rangeType === "week") {
      const end = addDays(rangeStart, 6);
      return {
        from: rangeStart,
        to: end,
        label: `${formatDayShort(rangeStart)} – ${formatDayShort(end)}`,
      };
    }
    const start = getMonthStart(rangeStart);
    const end = getMonthEnd(rangeStart);
    return { from: start, to: end, label: getMonthYear(rangeStart) };
  }, [rangeType, rangeStart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [g, e] = await Promise.all([
          apiFetch("/groups", { auth: true }),
          apiFetch(`/entries?from=${from}&to=${to}`, { auth: true }),
        ]);
        if (cancelled) return;
        setGroups(g.groups ?? []);
        setEntries(e.entries ?? []);
      } catch {
        if (!cancelled) setGroups([]), setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  function goPrev() {
    if (rangeType === "day") setRangeStart(addDays(rangeStart, -1));
    else if (rangeType === "week") setRangeStart(addDays(rangeStart, -7));
    else setRangeStart(addDays(getMonthStart(rangeStart), -1));
  }
  function goNext() {
    if (rangeType === "day") setRangeStart(addDays(rangeStart, 1));
    else if (rangeType === "week") setRangeStart(addDays(rangeStart, 7));
    else setRangeStart(addDays(getMonthEnd(rangeStart), 1));
  }

  const stats = useMemo(() => {
    const groupMap = new Map();
    function ensureGroup(id, name, color) {
      const key = id ?? "none";
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          id,
          name: id ? name : "No group",
          color: color || null,
          plannedCount: 0,
          doneCount: 0,
          plannedMinutes: 0,
          doneMinutes: 0,
          notDoneMinutes: 0,
        });
      }
      return groupMap.get(key);
    }
    for (const g of groups) ensureGroup(g.id, g.name, g.color);
    for (const e of entries) {
      const g = ensureGroup(
        e.groupId ?? null,
        groups.find((gg) => gg.id === e.groupId)?.name,
        groups.find((gg) => gg.id === e.groupId)?.color
      );
      g.plannedCount += 1;
      g.plannedMinutes += e.minutes;
      if (e.done) {
        g.doneCount += 1;
        g.doneMinutes += e.minutes;
      } else {
        g.notDoneMinutes += e.minutes;
      }
    }
    const list = Array.from(groupMap.values());
    const totalDone = list.reduce((a, g) => a + g.doneMinutes, 0);
    const totalPlanned = list.reduce((a, g) => a + g.plannedMinutes, 0);
    const totalNotDone = list.reduce((a, g) => a + g.notDoneMinutes, 0);
    const numDays = rangeType === "day" ? 1 : rangeType === "week" ? 7 : getDaysInMonth(rangeStart);
    const avgPerDay = numDays ? totalDone / numDays : 0;
    return { groups: list, totalDoneMinutes: totalDone, totalPlannedMinutes: totalPlanned, totalNotDoneMinutes: totalNotDone, avgPerDay };
  }, [groups, entries, rangeType, rangeStart]);

  const pieDone = useMemo(() => {
    const items = stats.groups.filter((g) => g.doneMinutes > 0);
    return items.map((g, idx) => ({
      id: g.id ?? "none",
      label: g.name,
      color: g.color || GROUP_COLORS[idx % GROUP_COLORS.length],
      value: g.doneMinutes,
    }));
  }, [stats.groups]);

  const pieNotDone = useMemo(() => {
    const items = stats.groups.filter((g) => g.notDoneMinutes > 0);
    return items.map((g, idx) => ({
      id: g.id ?? "none",
      label: g.name,
      color: g.color || GROUP_COLORS[idx % GROUP_COLORS.length],
      value: g.notDoneMinutes,
    }));
  }, [stats.groups]);

  const lineData = useMemo(() => {
    if (rangeType === "day") {
      const byHour = Array(24).fill(0);
      for (const e of entries) {
        if (!e.done) continue;
        const hour = Math.floor(e.startMin / 60);
        byHour[hour] = (byHour[hour] || 0) + e.minutes;
      }
      return byHour.map((minutes, hour) => ({ label: formatClock(hour * 60, timeFormat), minutes }));
    }
    const days = rangeType === "week" ? 7 : getDaysInMonth(rangeStart);
    const byDay = [];
    for (let i = 0; i < days; i++) {
      const d = rangeType === "week" ? addDays(rangeStart, i) : addDays(getMonthStart(rangeStart), i);
      const dayMinutes = entries
        .filter((e) => e.date === d && e.done)
        .reduce((s, e) => s + e.minutes, 0);
      byDay.push({ label: formatDayShort(d), date: d, minutes: dayMinutes });
    }
    return byDay;
  }, [rangeType, rangeStart, entries]);

  const maxLine = Math.max(1, ...lineData.map((d) => d.minutes));

  const linePaths = useMemo(() => {
    if (lineData.length === 0) return { linePath: "", areaPath: "" };
    const pts = lineData.map((d, i) => ({
      x: i,
      y: maxLine ? 100 - (d.minutes / maxLine) * 100 : 100,
    }));
    const n = pts.length - 1;
    let linePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i <= n; i++) {
      const dx = 1 / 3;
      linePath += ` C ${pts[i - 1].x + dx} ${pts[i - 1].y} ${pts[i].x - dx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    const curvePart = linePath.indexOf(" C") >= 0 ? linePath.slice(linePath.indexOf(" C")) : "";
    const areaPath = `M 0 100 L 0 ${pts[0].y} ${curvePart} L ${n} 100 Z`;
    return { linePath, areaPath };
  }, [lineData, maxLine]);

  const visibleLineTickIndexes = useMemo(() => {
    const count = lineData.length;
    if (count <= 1) return new Set([0]);

    // Keep week unchanged (already readable with 7 labels).
    if (rangeType === "week") {
      return new Set(Array.from({ length: count }, (_, i) => i));
    }

    // Day/month: show only ~6 ticks to avoid label overlap on mobile.
    const targetTicks = 6;
    const step = Math.max(1, Math.ceil((count - 1) / (targetTicks - 1)));
    const out = new Set([0, count - 1]);
    for (let i = step; i < count - 1; i += step) out.add(i);
    return out;
  }, [lineData.length, rangeType]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">FocusOS</div>
        <div className="app-right">
          <div className="app-user-email">{user?.email}</div>
          <CustomSelect
            className="app-select"
            value="Statistics"
            onChange={(v) => {
              if (v === "Calendar") navigate("/app");
              if (v === "Achievements") navigate("/achievements");
              if (v === "Settings") navigate("/settings");
            }}
            options={[
              { value: "Calendar", label: "Calendar" },
              { value: "Statistics", label: "Statistics" },
              { value: "Achievements", label: "Achievements" },
              { value: "Settings", label: "Settings" },
            ]}
          />
          <button className="icon-btn" type="button" onClick={() => signOut()} title="Sign out">↩</button>
        </div>
      </header>

      <div className="app-layout stats-layout">
        <aside className="sidebar">
          <h2 className="sidebar-title">Summary</h2>
          <div className="stats-range-controls">
            <CustomSelect
              className="modal-input"
              value={rangeType}
              onChange={(v) => {
                setRangeType(v);
                if (v === "day") setRangeStart(getTodayYMD());
                else if (v === "week") setRangeStart(getMonday(getTodayYMD()));
                else setRangeStart(getMonthStart(getTodayYMD()));
              }}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
            <div className="stats-range-nav">
              <button type="button" className="icon-btn" onClick={goPrev} title="Previous">‹</button>
              <span className="stats-range-label">{label}</span>
              <button type="button" className="icon-btn" onClick={goNext} title="Next">›</button>
            </div>
          </div>
          {loading ? (
            <div className="task-empty">Loading…</div>
          ) : (
            <>
              <div className="task-empty stats-summary-box">
                <div>Planned: {minutesToHhMm(stats.totalPlannedMinutes)}</div>
                <div>Done: {minutesToHhMm(stats.totalDoneMinutes)}</div>
                <div>Not done: {minutesToHhMm(stats.totalNotDoneMinutes)}</div>
                <div>Avg per day: {minutesToHhMm(Math.round(stats.avgPerDay))}</div>
              </div>
              <h3 className="sidebar-title" style={{ marginTop: 16, fontSize: 14 }}>By group</h3>
              <div className="group-list" style={{ flexDirection: "column" }}>
                {stats.groups.map((g, idx) => {
                  const color = g.color || GROUP_COLORS[idx % GROUP_COLORS.length];
                  return (
                    <div key={g.id ?? "none"} className="group-pill" style={{ borderLeftColor: color }}>
                      <span className="group-dot" style={{ background: color }} />
                      <span className="group-name">{g.name} • {g.doneCount}/{g.plannedCount}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        <main className="stats-main">
          {loading ? (
            <div className="task-empty">Loading…</div>
          ) : (
            <>
              <div className="stats-donuts">
                <DonutChart
                  data={pieDone}
                  title="Done"
                  totalLabel="Done"
                  emptyLabel="Nothing completed yet"
                />
                <DonutChart
                  data={pieNotDone}
                  title="Not done"
                  totalLabel="Not done"
                  emptyLabel="Nothing pending"
                />
              </div>
              <div className="stats-line-section">
                <h3 className="stats-line-title">
                  {rangeType === "day" ? "Focus by hour" : "Focus by day"}
                </h3>
                <div className="stats-line-chart">
                  <div className="stats-line-y">
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                      <div key={frac}>{Math.round(maxLine * frac)}</div>
                    ))}
                  </div>
                  <div className="stats-line-area">
                    {lineData.length === 0 ? (
                      <div className="stats-line-empty">No data</div>
                    ) : (
                      <svg viewBox={`0 0 ${Math.max(lineData.length, 1)} 100`} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="stats-line-gradient" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="rgba(129, 140, 248, 0.08)" />
                            <stop offset="100%" stopColor="rgba(129, 140, 248, 0.22)" />
                          </linearGradient>
                        </defs>
                        <path className="line-fill" d={linePaths.areaPath} />
                        <path className="line-stroke" d={linePaths.linePath} />
                      </svg>
                    )}
                  </div>
                  <div className="stats-line-x">
                    {lineData.map((d, i) => (
                      <div key={d.label || i}>{visibleLineTickIndexes.has(i) ? d.label : ""}</div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
