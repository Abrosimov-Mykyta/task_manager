import { useEffect, useMemo, useState, useRef } from "react";
import "../App.css";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../lib/api";
import TaskModal from "../components/TaskModal";
import GroupModal from "../components/GroupModal";
import EntryModal from "../components/EntryModal";
import CustomSelect from "../components/CustomSelect";
import { useNavigate } from "react-router-dom";
import { getMonday, addDays, toYMD, formatDayShort } from "../lib/dateUtils";
import { useSettings } from "../settings/SettingsProvider";
import { formatClock } from "../lib/formatting";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export default function CalendarPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getMonday(toYMD(new Date())));

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createEntry, setCreateEntry] = useState(null); // { dayIndex, startMin }
  const [editEntry, setEditEntry] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // { dayIndex, startMin } | null
  const isDraggingEntryRef = useRef(false);
  const { calendarSettings, timeFormat, language } = useSettings();

  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const timeSlots = useMemo(() => {
    const { startMinutes, endMinutes, stepMinutes } = calendarSettings;
    const start = startMinutes;
    const end = endMinutes;
    const out = [];
    for (let m = start; m < end; m += stepMinutes) out.push(m);
    return out;
  }, [calendarSettings]);

  function formatTime(totalMinutes) {
    return formatClock(totalMinutes, timeFormat);
  }

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [t, g] = await Promise.all([
          apiFetch("/tasks", { auth: true }),
          apiFetch("/groups", { auth: true }),
        ]);
        if (cancelled) return;
        setTasks(t.tasks ?? []);
        setGroups(g.groups ?? []);
        const e = await apiFetch(`/entries?from=${weekStart}&to=${weekEnd}`, { auth: true });
        if (cancelled) return;
        setEntries(e.entries ?? []);
      } catch {
        if (!cancelled) {
          setTasks([]);
          setGroups([]);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd]);

  async function createGroup(payload) {
    const data = await apiFetch("/groups", {
      auth: true,
      method: "POST",
      body: JSON.stringify(payload),
    });
    setGroups((prev) => [...prev, data.group]);
  }

  async function createTask(payload) {
    const data = await apiFetch("/tasks", {
      auth: true,
      method: "POST",
      body: JSON.stringify(payload),
    });
    setTasks((prev) => [...prev, data.task]);
  }

  async function updateTask(taskId, payload) {
    const data = await apiFetch(`/tasks/${taskId}`, {
      auth: true,
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
  }

  async function deleteTask(taskId) {
    await apiFetch(`/tasks/${taskId}`, { auth: true, method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function createCalendarEntry(payload) {
    if (!createEntry) return;
    const date = addDays(weekStart, createEntry.dayIndex);
    if (hasEntryOverlap(date, createEntry.startMin, payload.minutes)) {
      throw new Error("Цей час зайнятий іншою задачею.");
    }
    const data = await apiFetch("/entries", {
      auth: true,
      method: "POST",
      body: JSON.stringify({
        date,
        dayIndex: createEntry.dayIndex,
        startMin: createEntry.startMin,
        ...payload,
      }),
    });
    setEntries((prev) => [...prev, data.entry]);
  }

  async function updateCalendarEntry(entryId, payload) {
    const existing = entries.find((e) => String(e.id) === String(entryId));
    if (existing) {
      const nextDate = payload.date ?? existing.date;
      const nextStartMin = payload.startMin ?? existing.startMin;
      const nextMinutes = payload.minutes ?? existing.minutes;
      const timingChanged =
        payload.date !== undefined ||
        payload.startMin !== undefined ||
        payload.minutes !== undefined;
      if (timingChanged && hasEntryOverlap(nextDate, nextStartMin, nextMinutes, entryId)) {
        throw new Error("Цей час зайнятий іншою задачею.");
      }
    }
    const data = await apiFetch(`/entries/${entryId}`, {
      auth: true,
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setEntries((prev) => prev.map((e) => (e.id == entryId ? data.entry : e)));
  }

  async function deleteCalendarEntry(entryId) {
    await apiFetch(`/entries/${entryId}`, { auth: true, method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  function snapToStep(min) {
    const step = calendarSettings.stepMinutes;
    return Math.round(min / step) * step;
  }

  function getRowBaseHeight() {
    if (calendarSettings.stepMinutes === 15) return 32;
    if (calendarSettings.stepMinutes === 30) return 44;
    return 56;
  }

  function getChipHeight(minutes) {
    const step = calendarSettings.stepMinutes;
    const rowBase = getRowBaseHeight();
    const oneSlotHeight = rowBase - 8;
    const slots = minutes / step;
    if (slots <= 1) return Math.max(16, oneSlotHeight * slots);
    return oneSlotHeight + (slots - 1) * rowBase;
  }

  function canShareSingleSlot(date, startMin, minutes, excludeEntryId = null) {
    const step = calendarSettings.stepMinutes;
    if (minutes > step) return false;
    const sameStart = entries.filter((e) => {
      if (e.date !== date || e.startMin !== startMin) return false;
      if (excludeEntryId != null && String(e.id) === String(excludeEntryId)) return false;
      return true;
    });
    if (sameStart.some((e) => e.minutes > step)) return false;
    const used = sameStart.reduce((sum, e) => sum + e.minutes, 0);
    return used + minutes <= step;
  }

  function hasEntryOverlap(date, startMin, minutes, excludeEntryId = null) {
    const endMin = startMin + minutes;
    return entries.some((e) => {
      if (e.date !== date) return false;
      if (excludeEntryId != null && String(e.id) === String(excludeEntryId)) return false;
      const eStart = e.startMin;
      const eEnd = e.startMin + e.minutes;
      const overlap = startMin < eEnd && endMin > eStart;
      if (!overlap) return false;
      if (eStart === startMin && canShareSingleSlot(date, startMin, minutes, excludeEntryId)) {
        return false;
      }
      return true;
    });
  }

  function isCellCovered(date, startMin) {
    return entries.some(
      (e) =>
        e.date === date &&
        startMin >= e.startMin &&
        startMin < e.startMin + e.minutes &&
        startMin !== e.startMin
    );
  }

  function openCreateEntry(dayIndex, startMin) {
    const snapped = snapToStep(startMin);
    const date = addDays(weekStart, dayIndex);
    if (isCellCovered(date, snapped)) return;
    setCreateEntry({ dayIndex, startMin: snapped });
  }

  async function createCalendarEntryFromTask(task, dayIndex, startMin) {
    const date = addDays(weekStart, dayIndex);
    const snapped = snapToStep(startMin);
    if (hasEntryOverlap(date, snapped, task.minutes)) {
      throw new Error("Цей час зайнятий іншою задачею.");
    }
    const g = task.groupId ? groupById.get(task.groupId) : null;
    const color = task.color || g?.color || "#6366f1";
    const data = await apiFetch("/entries", {
      auth: true,
      method: "POST",
      body: JSON.stringify({
        date,
        dayIndex,
        startMin: snapped,
        title: task.title,
        minutes: task.minutes,
        color,
        groupId: task.groupId || null,
      }),
    });
    setEntries((prev) => [...prev, data.entry]);
  }

  function handleCellDragOver(e, dayIndex, startMin) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    e.stopPropagation();
    setDragOverCell({ dayIndex, startMin });
  }

  function handleCellDragLeave() {
    setDragOverCell(null);
  }

  function processDrop(e, dayIndex, startMin) {
    const snapped = snapToStep(startMin);
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data.type === "task" && data.task) {
          createCalendarEntryFromTask(data.task, dayIndex, startMin).catch((err) =>
            console.error("Create entry from task failed", err)
          );
          return;
        }
        if (data.type === "entry" && data.entryId != null) {
          updateCalendarEntry(String(data.entryId), {
            date: addDays(weekStart, dayIndex),
            dayIndex,
            startMin: snapped,
          });
          return;
        }
      } catch (_) {}
    }
    const type = e.dataTransfer.getData("application/focusos-type");
    const payload = e.dataTransfer.getData("application/focusos-payload");
    if (!payload) return;
    if (type === "task") {
      try {
        const task = JSON.parse(payload);
        createCalendarEntryFromTask(task, dayIndex, startMin).catch((err) =>
          console.error("Create entry from task failed", err)
        );
      } catch (_) {}
      return;
    }
    if (type === "entry") {
      updateCalendarEntry(payload, {
        date: addDays(weekStart, dayIndex),
        dayIndex,
        startMin: snapped,
      });
    }
  }

  function handleCellDrop(e, dayIndex, startMin) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    processDrop(e, dayIndex, startMin);
  }

  function handleTaskDragStart(e, task) {
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "task",
        task: {
          id: task.id,
          title: task.title,
          minutes: task.minutes,
          color: task.color || null,
          groupId: task.groupId || null,
        },
      })
    );
    e.currentTarget.classList.add("dragging");
  }

  function handleTaskDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
  }

  function handleEntryDragStart(e, entry) {
    isDraggingEntryRef.current = true;
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "entry", entryId: entry.id }));
    e.dataTransfer.setData("application/focusos-type", "entry");
    e.dataTransfer.setData("application/focusos-payload", String(entry.id));
    e.dataTransfer.effectAllowed = "copyMove";
    e.currentTarget.classList.add("dragging");
  }

  function handleEntryDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
    setTimeout(() => { isDraggingEntryRef.current = false; }, 0);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">FocusOS</div>
        <div className="app-right">
          <div style={{ fontSize: 12, color: "rgba(229,231,235,0.7)" }}>
            {user?.email}
          </div>
          <CustomSelect
            className="app-select"
            value="Календар"
            onChange={(v) => {
              if (v === "Статистика") navigate("/stats");
              if (v === "Досягнення") navigate("/achievements");
              if (v === "Налаштування") navigate("/settings");
            }}
            options={[
              { value: "Календар", label: "Календар" },
              { value: "Статистика", label: "Статистика" },
              { value: "Досягнення", label: "Досягнення" },
              { value: "Налаштування", label: "Налаштування" },
            ]}
          />
          <button className="icon-btn" type="button" onClick={() => signOut()} title="Вийти">
            ↩
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h2 className="sidebar-title" style={{ margin: 0 }}>
                Групи
              </h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setCreateGroupOpen(true)}
                title="Додати групу"
                aria-label="Add group"
              >
                +
              </button>
            </div>

            <div className="group-list">
              {loading ? (
                <div className="task-empty">Завантаження...</div>
              ) : groups.length === 0 ? (
                <div className="task-empty">Поки немає груп. Додай першу.</div>
              ) : (
                groups.map((g) => (
                  <div key={g.id} className="group-pill" style={{ borderLeftColor: g.color || "#22c55e" }}>
                    <span className="group-dot" style={{ background: g.color || "#22c55e" }} />
                    <span className="group-name">{g.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-divider" />

          <h2 className="sidebar-title">Мої задачі</h2>
          <button className="sidebar-add" type="button" onClick={() => setCreateOpen(true)}>
            + Додати задачу
          </button>

          <div className="task-list">
            {loading ? (
              <div className="task-empty">Завантаження...</div>
            ) : tasks.length === 0 ? (
              <div className="task-empty">Поки немає задач. Створи першу.</div>
            ) : (
              tasks.map((t) => {
                const g = t.groupId ? groupById.get(t.groupId) : null;
                const accent = t.color || g?.color || "#6366f1";
                return (
                  <div
                    key={t.id}
                    className="task-item"
                    style={{ borderLeftColor: accent }}
                    draggable
                    onDragStart={(e) => handleTaskDragStart(e, t)}
                    onDragEnd={handleTaskDragEnd}
                  >
                    <div className="task-main">
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">
                        {t.minutes} хв{g ? ` • ${g.name}` : ""}
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setEditTask(t)}
                      aria-label="Task settings"
                      title="Налаштування"
                    >
                      ⚙
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="calendar">
          <div className="calendar-header">
            <div className="calendar-time-spacer" />
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="calendar-day-header">
                <div>{language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayIndex] : day}</div>
                <div className="calendar-day-date">{formatDayShort(addDays(weekStart, dayIndex))}</div>
              </div>
            ))}
          </div>
          <div className="calendar-week-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              title="Попередній тиждень"
            >
              ‹
            </button>
            <span className="calendar-week-range">
              {formatDayShort(weekStart)} – {formatDayShort(weekEnd)}
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              title="Наступний тиждень"
            >
              ›
            </button>
          </div>

          <div className="calendar-body">
            {timeSlots.map((minutes) => (
              <div
                key={minutes}
                className="calendar-row"
                style={{
                  minHeight: getRowBaseHeight(),
                }}
              >
                <div className="calendar-time">{formatTime(minutes)}</div>
                {DAYS.map((day, dayIndex) => {
                  const dayDate = addDays(weekStart, dayIndex);
                  const covered = isCellCovered(dayDate, minutes);
                  const cellEntries = entries.filter(
                    (e) => e.date === dayDate && e.startMin === minutes
                  );
                  return (
                    <div
                      key={day}
                      className={`calendar-cell${covered ? " calendar-cell-covered" : ""}${dragOverCell?.dayIndex === dayIndex && dragOverCell?.startMin === minutes ? " calendar-cell-drag-over" : ""}`}
                      style={{ position: "relative", overflow: "visible" }}
                      data-cell-day={dayIndex}
                      data-cell-start={minutes}
                      onClick={() => {
                        if (covered) return;
                        openCreateEntry(dayIndex, minutes);
                      }}
                      onDragOver={(e) => handleCellDragOver(e, dayIndex, minutes)}
                      onDragLeave={handleCellDragLeave}
                      onDrop={(e) => handleCellDrop(e, dayIndex, minutes)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !covered) openCreateEntry(dayIndex, minutes);
                      }}
                    >
                      {cellEntries.map((en, idx) => {
                        const g = en.groupId ? groupById.get(en.groupId) : null;
                        const accent = en.color || g?.color || "#6366f1";
                        const chipHeight = getChipHeight(en.minutes);
                        const gap = 8;
                        const topOffset =
                          4 +
                          cellEntries
                            .slice(0, idx)
                            .reduce((sum, e) => sum + getChipHeight(e.minutes) + gap, 0);
                        return (
                          <div
                            key={en.id}
                            className={`entry-chip${en.done ? " done" : ""}`}
                            style={{
                              borderLeftColor: accent,
                              height: chipHeight,
                              top: topOffset,
                            }}
                            draggable
                            onDragStart={(e) => handleEntryDragStart(e, en)}
                            onDragEnd={handleEntryDragEnd}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (!isDraggingEntryRef.current) setEditEntry(en);
                            }}
                            role="presentation"
                          >
                            <div className="entry-head">
                              <button
                                type="button"
                                className="entry-done-toggle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCalendarEntry(en.id, { done: !en.done });
                                }}
                                aria-label={en.done ? "Позначити невиконаним" : "Позначити виконаним"}
                              >
                                {en.done ? "✓" : ""}
                              </button>
                              <span className="entry-title-text" title={en.title}>{en.title}</span>
                              <span className="entry-time">{en.minutes} хв</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </main>
      </div>

      <TaskModal
        open={createOpen}
        title="Нова задача"
        groups={groups}
        initial={{ title: "", minutes: 30, color: "#6366f1", groupId: "" }}
        onClose={() => setCreateOpen(false)}
        onSubmit={createTask}
        submitLabel="Створити"
      />

      <TaskModal
        open={!!editTask}
        title="Налаштування задачі"
        groups={groups}
        initial={editTask}
        onClose={() => setEditTask(null)}
        onSubmit={(payload) => updateTask(editTask.id, payload)}
        allowDelete
        onDelete={() => deleteTask(editTask.id)}
      />

      <GroupModal
        open={createGroupOpen}
        title="Нова група"
        initial={{ name: "", color: "#22c55e" }}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={createGroup}
        submitLabel="Створити"
      />

      <EntryModal
        open={!!createEntry}
        title={
          createEntry
            ? `Запланувати • ${DAYS[createEntry.dayIndex]} • ${formatTime(createEntry.startMin)}`
            : "Запланувати"
        }
        groups={groups}
        initial={{ title: "", minutes: calendarSettings.stepMinutes, color: "#6366f1", groupId: "" }}
        onClose={() => setCreateEntry(null)}
        onSubmit={createCalendarEntry}
        submitLabel="Додати"
      />

      <EntryModal
        open={!!editEntry}
        title="Запланована задача"
        groups={groups}
        initial={editEntry}
        onClose={() => setEditEntry(null)}
        onSubmit={(payload) => updateCalendarEntry(editEntry.id, payload)}
        allowDelete
        onDelete={() => deleteCalendarEntry(editEntry.id)}
      />
    </div>
  );
}