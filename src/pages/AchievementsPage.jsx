import { useEffect, useMemo, useState } from "react";
import "../App.css";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { addDays, getMonday, getTodayYMD } from "../lib/dateUtils";
import CustomSelect from "../components/CustomSelect";

const ACHIEVEMENTS = [
  {
    id: "workhorse",
    title: "Workhorse",
    description: "Complete tasks for a given number of hours in a single day",
    icon: "💪",
    levels: [
      { name: "Bronze", value: 360, label: "6 h / day", emoji: "🥉" },
      { name: "Silver", value: 480, label: "8 h / day", emoji: "🥈" },
      { name: "Gold", value: 600, label: "10 h / day", emoji: "🥇" },
    ],
    check: (stats) => stats.maxMinutesInDay,
    unit: "min",
  },
  {
    id: "consistency",
    title: "Consistency",
    description: "Average completed task time per day in your best week",
    icon: "📅",
    levels: [
      { name: "Bronze", value: 240, label: "4 h / day (avg.)", emoji: "🥉" },
      { name: "Silver", value: 360, label: "6 h / day (avg.)", emoji: "🥈" },
      { name: "Gold", value: 480, label: "8 h / day (avg.)", emoji: "🥇" },
    ],
    check: (stats) => stats.bestWeekAvgMinutesPerDay,
    unit: "min",
  },
  {
    id: "diverse",
    title: "Well rounded",
    description: "Use different categories (groups) in one week",
    icon: "🎯",
    levels: [
      { name: "Bronze", value: 3, label: "3 groups", emoji: "🥉" },
      { name: "Silver", value: 5, label: "5 groups", emoji: "🥈" },
      { name: "Gold", value: 7, label: "7 groups", emoji: "🥇" },
    ],
    check: (stats) => stats.maxGroupsInWeek,
    unit: "",
  },
  {
    id: "streak",
    title: "Streak",
    description: "Consecutive days with at least a minimum of completed task time",
    icon: "🔥",
    levels: [
      { name: "Bronze", value: 3, label: "3 days at 2 h", emoji: "🥉", minMinutesPerDay: 120 },
      { name: "Silver", value: 5, label: "5 days at 3 h", emoji: "🥈", minMinutesPerDay: 180 },
      { name: "Gold", value: 7, label: "7 days at 4 h", emoji: "🥇", minMinutesPerDay: 240 },
    ],
    check: (stats, level) => stats.bestStreakByThreshold?.[level?.minMinutesPerDay ?? 0] ?? 0,
    compareValue: (level) => level.value,
    unit: "days",
  },
  {
    id: "veteran",
    title: "Veteran",
    description: "Total number of completed tasks",
    icon: "⭐",
    levels: [
      { name: "Bronze", value: 50, label: "50 tasks", emoji: "🥉" },
      { name: "Silver", value: 200, label: "200 tasks", emoji: "🥈" },
      { name: "Gold", value: 500, label: "500 tasks", emoji: "🥇" },
    ],
    check: (stats) => stats.totalDoneCount,
    unit: "",
  },
];

function computeAchievementStats(entries) {
  const done = (entries || []).filter((e) => e.done);
  const byDate = new Map();
  for (const e of done) {
    if (!e.date) continue;
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.minutes);
  }
  const byWeek = new Map();
  for (const e of done) {
    if (!e.date) continue;
    const mon = getMonday(e.date);
    if (!byWeek.has(mon)) byWeek.set(mon, { minutes: 0, days: new Set(), groups: new Set() });
    const w = byWeek.get(mon);
    w.minutes += e.minutes;
    w.days.add(e.date);
    if (e.groupId) w.groups.add(e.groupId);
  }
  let maxMinutesInDay = 0;
  for (const m of byDate.values()) if (m > maxMinutesInDay) maxMinutesInDay = m;
  let bestWeekAvgMinutesPerDay = 0;
  for (const w of byWeek.values()) {
    const avg = w.days.size ? w.minutes / 7 : 0;
    if (avg > bestWeekAvgMinutesPerDay) bestWeekAvgMinutesPerDay = avg;
  }
  let maxGroupsInWeek = 0;
  for (const w of byWeek.values()) {
    if (w.groups.size > maxGroupsInWeek) maxGroupsInWeek = w.groups.size;
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  const bestStreakByThreshold = {};
  for (const minPerDay of [120, 180, 240]) {
    let best = 0;
    let current = 0;
    let prevDate = null;
    for (const date of sortedDates) {
      const m = byDate.get(date) ?? 0;
      if (m < minPerDay) {
        current = 0;
        prevDate = null;
        continue;
      }
      if (prevDate == null) {
        current = 1;
      } else {
        const prev = new Date(prevDate.replace(/-/g, "/"));
        const curr = new Date(date.replace(/-/g, "/"));
        const diffDays = Math.round((curr - prev) / 86400000);
        if (diffDays === 1) current += 1;
        else current = 1;
      }
      prevDate = date;
      if (current > best) best = current;
    }
    bestStreakByThreshold[minPerDay] = best;
  }
  return {
    maxMinutesInDay,
    bestWeekAvgMinutesPerDay: Math.round(bestWeekAvgMinutesPerDay),
    maxGroupsInWeek,
    bestStreakByThreshold,
    totalDoneCount: done.length,
  };
}

function formatValue(value, ach, level) {
  if (ach.id === "workhorse" || ach.id === "consistency") {
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  if (ach.id === "streak") return `${value} d`;
  return String(value);
}

export default function AchievementsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const to = getTodayYMD();
    const from = addDays(to, -180);
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/entries?from=${from}&to=${to}`, { auth: true });
        if (!cancelled) setEntries(res.entries ?? []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => computeAchievementStats(entries), [entries]);

  const achievementProgress = useMemo(() => {
    return ACHIEVEMENTS.map((ach) => {
      const current = ach.id === "streak"
        ? null
        : (ach.check(stats) ?? 0);
      const levelsUnlocked = ach.levels.map((level, idx) => {
        let value;
        if (ach.id === "streak") {
          value = ach.check(stats, level) ?? 0;
          return value >= level.value;
        }
        value = current;
        return value >= level.value;
      });
      return { ach, current, levelsUnlocked };
    });
  }, [stats]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">FocusOS</div>
        <div className="app-right">
          <div className="app-user-email">{user?.email}</div>
          <CustomSelect
            className="app-select"
            value="Achievements"
            onChange={(v) => {
              if (v === "Calendar") navigate("/app");
              if (v === "Statistics") navigate("/stats");
              if (v === "Settings") navigate("/settings");
            }}
            options={[
              { value: "Calendar", label: "Calendar" },
              { value: "Statistics", label: "Statistics" },
              { value: "Achievements", label: "Achievements" },
              { value: "Settings", label: "Settings" },
            ]}
          />
          <button className="icon-btn" type="button" onClick={() => signOut()} title="Sign out">
            ↩
          </button>
        </div>
      </header>

      <main className="achievements-main">
        <h1 className="achievements-title">Achievements</h1>
        <p className="achievements-subtitle">
          Complete tasks in the calendar — unlock achievement tiers over the last 6 months.
        </p>

        {loading ? (
          <div className="task-empty">Loading…</div>
        ) : (
          <div className="achievements-grid">
            {achievementProgress.map(({ ach, current, levelsUnlocked }) => (
              <div key={ach.id} className="achievement-card">
                <div className="achievement-header">
                  <span className="achievement-icon">{ach.icon}</span>
                  <div>
                    <h2 className="achievement-name">{ach.title}</h2>
                    <p className="achievement-desc">{ach.description}</p>
                  </div>
                </div>
                {ach.id !== "streak" && current != null && (
                  <div className="achievement-current">
                    Current: {formatValue(current, ach)}
                  </div>
                )}
                <div className="achievement-levels">
                  {ach.levels.map((level, idx) => {
                    const unlocked = levelsUnlocked[idx];
                    const valueForLevel =
                      ach.id === "streak"
                        ? (stats.bestStreakByThreshold?.[level.minMinutesPerDay] ?? 0)
                        : current;
                    const target = level.value;
                    return (
                      <div
                        key={level.name}
                        className={`achievement-level ${unlocked ? "unlocked" : "locked"}`}
                      >
                        <span className="level-emoji">{level.emoji}</span>
                        <span className="level-name">{level.name}</span>
                        <span className="level-label">{level.label}</span>
                        {unlocked ? (
                          <span className="level-done">✓</span>
                        ) : ach.id === "streak" ? (
                          <span className="level-progress">
                            {valueForLevel}/{target} d
                          </span>
                        ) : (
                          <span className="level-progress">
                            {ach.id === "diverse" || ach.id === "veteran"
                              ? `${valueForLevel ?? 0}/${target}`
                              : `${formatValue(current ?? 0, ach)} / ${ach.id === "workhorse" || ach.id === "consistency" ? (target / 60) + " h" : target}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
