import { useEffect, useMemo, useState, useRef } from "react";
import "../App.css";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../lib/api";
import TaskModal from "../components/TaskModal";
import GroupModal from "../components/GroupModal";
import EntryModal from "../components/EntryModal";
import CustomSelect from "../components/CustomSelect";
import { useNavigate } from "react-router-dom";
import {
  toYMD,
  formatDayShort,
  getMonthStart,
  getMonthEnd,
  getMonthYear,
  getDatesInMonth,
  dayIndexFromDate,
  shiftMonthStart,
} from "../lib/dateUtils";
import { useSettings } from "../settings/SettingsProvider";
import { formatClock } from "../lib/formatting";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Equal width for each day column (horizontal month strip) */
const CAL_DAY_COL_PX = 280;

export default function CalendarPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const monthScrollRef = useRef(null);
  const didInitialTodayScrollRef = useRef(false);
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(() => getMonthStart(toYMD(new Date())));

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createEntry, setCreateEntry] = useState(null); // { date, startMin } YYYY-MM-DD
  const [editEntry, setEditEntry] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // { date, startMin } | null
  const isDraggingEntryRef = useRef(false);
  const { calendarSettings, timeFormat } = useSettings();

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

  const monthDays = useMemo(() => getDatesInMonth(monthAnchor), [monthAnchor]);

  const monthStartYmd = useMemo(() => getMonthStart(monthAnchor), [monthAnchor]);
  const monthEndYmd = useMemo(() => getMonthEnd(monthAnchor), [monthAnchor]);

  const entriesRange = useMemo(
    () => ({ from: monthStartYmd, to: monthEndYmd }),
    [monthStartYmd, monthEndYmd]
  );

  const calendarGridColumns = useMemo(
    () => `144px repeat(${monthDays.length}, ${CAL_DAY_COL_PX}px)`,
    [monthDays.length]
  );

  useEffect(() => {
    if (didInitialTodayScrollRef.current) return;
    const scroller = monthScrollRef.current;
    if (!scroller || monthDays.length === 0) return;

    const todayYmd = toYMD(new Date());
    const todayIndex = monthDays.indexOf(todayYmd);
    if (todayIndex < 0) return;

    const timeColWidth = 144;
    const targetLeft =
      timeColWidth +
      todayIndex * CAL_DAY_COL_PX -
      (scroller.clientWidth / 2 - CAL_DAY_COL_PX / 2);
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const clampedLeft = Math.min(Math.max(0, targetLeft), maxLeft);

    scroller.scrollLeft = clampedLeft;
    didInitialTodayScrollRef.current = true;
  }, [monthDays]);

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
        const { from, to } = entriesRange;
        const e = await apiFetch(`/entries?from=${from}&to=${to}`, { auth: true });
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
  }, [entriesRange.from, entriesRange.to]);

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
    const { date, startMin } = createEntry;
    if (hasEntryOverlap(date, startMin, payload.minutes)) {
      throw new Error("This time slot overlaps another entry.");
    }
    const data = await apiFetch("/entries", {
      auth: true,
      method: "POST",
      body: JSON.stringify({
        date,
        dayIndex: dayIndexFromDate(date),
        startMin,
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
        throw new Error("This time slot overlaps another entry.");
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
    if (calendarSettings.stepMinutes === 15) return 64;
    if (calendarSettings.stepMinutes === 30) return 88;
    return 112;
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

  function openCreateEntry(startMin, dayDate) {
    const snapped = snapToStep(startMin);
    if (isCellCovered(dayDate, snapped)) return;
    setCreateEntry({ date: dayDate, startMin: snapped });
  }

  async function createCalendarEntryFromTask(task, startMin, dayDate) {
    const snapped = snapToStep(startMin);
    if (hasEntryOverlap(dayDate, snapped, task.minutes)) {
      throw new Error("This time slot overlaps another entry.");
    }
    const g = task.groupId ? groupById.get(task.groupId) : null;
    const color = task.color || g?.color || "#6366f1";
    const data = await apiFetch("/entries", {
      auth: true,
      method: "POST",
      body: JSON.stringify({
        date: dayDate,
        dayIndex: dayIndexFromDate(dayDate),
        startMin: snapped,
        title: task.title,
        minutes: task.minutes,
        color,
        groupId: task.groupId || null,
      }),
    });
    setEntries((prev) => [...prev, data.entry]);
  }

  function handleCellDragOver(e, startMin, dayDate) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    e.stopPropagation();
    setDragOverCell({ date: dayDate, startMin });
  }

  function handleCellDragLeave() {
    setDragOverCell(null);
  }

  function processDrop(e, startMin, dayDate) {
    const snapped = snapToStep(startMin);
    const di = dayIndexFromDate(dayDate);
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data.type === "task" && data.task) {
          createCalendarEntryFromTask(data.task, startMin, dayDate).catch((err) =>
            console.error("Create entry from task failed", err)
          );
          return;
        }
        if (data.type === "entry" && data.entryId != null) {
          updateCalendarEntry(String(data.entryId), {
            date: dayDate,
            dayIndex: di,
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
        createCalendarEntryFromTask(task, startMin, dayDate).catch((err) =>
          console.error("Create entry from task failed", err)
        );
      } catch (_) {}
      return;
    }
    if (type === "entry") {
      updateCalendarEntry(payload, {
        date: dayDate,
        dayIndex: di,
        startMin: snapped,
      });
    }
  }

  function handleCellDrop(e, startMin, dayDate) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    processDrop(e, startMin, dayDate);
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
          <div className="app-user-email">
            {user?.email}
          </div>
          <CustomSelect
            className="app-select"
            value="Calendar"
            onChange={(v) => {
              if (v === "Statistics") navigate("/stats");
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
          <button className="icon-btn" type="button" onClick={() => signOut()} title="Sign out">
            ↩
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h2 className="sidebar-title" style={{ margin: 0 }}>
                Groups
              </h2>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setCreateGroupOpen(true)}
                title="Add group"
                aria-label="Add group"
              >
                +
              </button>
            </div>

            <div className="group-list">
              {loading ? (
                <div className="task-empty">Loading…</div>
              ) : groups.length === 0 ? (
                <div className="task-empty">No groups yet. Add your first one.</div>
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

          <h2 className="sidebar-title">My tasks</h2>
          <button className="sidebar-add" type="button" onClick={() => setCreateOpen(true)}>
            + Add task
          </button>

          <div className="task-list">
            {loading ? (
              <div className="task-empty">Loading…</div>
            ) : tasks.length === 0 ? (
              <div className="task-empty">No tasks yet. Create your first one.</div>
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
                        {t.minutes} min{g ? ` • ${g.name}` : ""}
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setEditTask(t)}
                      aria-label="Task settings"
                      title="Task settings"
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
          <div className="calendar-month-toolbar">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonthAnchor((m) => shiftMonthStart(m, -1))}
              title="Previous month"
            >
              ‹
            </button>
            <span className="calendar-month-label">{getMonthYear(monthAnchor)}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMonthAnchor((m) => shiftMonthStart(m, 1))}
              title="Next month"
            >
              ›
            </button>
          </div>

          <div className="calendar-month-scroll" ref={monthScrollRef}>
            <div
              className="calendar-month-strip"
              style={{
                minWidth: `calc(144px + ${monthDays.length} * ${CAL_DAY_COL_PX}px)`,
              }}
            >
              <div className="calendar-header" style={{ gridTemplateColumns: calendarGridColumns }}>
                <div className="calendar-time-spacer" />
                {monthDays.map((dayDate) => (
                  <div key={dayDate} className="calendar-day-header">
                    <div>{DAYS[dayIndexFromDate(dayDate)]}</div>
                    <div className="calendar-day-date">{formatDayShort(dayDate)}</div>
                  </div>
                ))}
              </div>
              <div className="calendar-body">
                {timeSlots.map((minutes) => (
                  <div
                    key={minutes}
                    className="calendar-row"
                    style={{
                      minHeight: getRowBaseHeight(),
                      gridTemplateColumns: calendarGridColumns,
                    }}
                  >
                    <div className="calendar-time">{formatTime(minutes)}</div>
                    {monthDays.map((dayDate) => {
                      const covered = isCellCovered(dayDate, minutes);
                      const cellEntries = entries.filter(
                        (e) => e.date === dayDate && e.startMin === minutes
                      );
                      const dragMatch =
                        dragOverCell?.date === dayDate && dragOverCell?.startMin === minutes;
                      return (
                        <div
                          key={`${dayDate}-${minutes}`}
                          className={`calendar-cell${covered ? " calendar-cell-covered" : ""}${dragMatch ? " calendar-cell-drag-over" : ""}`}
                          style={{ position: "relative", overflow: "visible" }}
                          data-cell-date={dayDate}
                          data-cell-start={minutes}
                          onClick={() => {
                            if (covered) return;
                            openCreateEntry(minutes, dayDate);
                          }}
                          onDragOver={(e) => handleCellDragOver(e, minutes, dayDate)}
                          onDragLeave={handleCellDragLeave}
                          onDrop={(e) => handleCellDrop(e, minutes, dayDate)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !covered) openCreateEntry(minutes, dayDate);
                          }}
                        >
                          {cellEntries.map((en, idx) => {
                            const g = en.groupId ? groupById.get(en.groupId) : null;
                            const accent = en.color || g?.color || "#6366f1";
                            const chipHeight = getChipHeight(en.minutes);
                            const gap = 10;
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
                                    aria-label={en.done ? "Mark as not done" : "Mark as done"}
                                  >
                                    {en.done ? "✓" : ""}
                                  </button>
                                  <span className="entry-title-text" title={en.title}>
                                    {en.title}
                                  </span>
                                  <span className="entry-time">{en.minutes} min</span>
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
            </div>
          </div>
        </main>
      </div>

      <TaskModal
        open={createOpen}
        title="New task"
        groups={groups}
        initial={{ title: "", minutes: 30, color: "#6366f1", groupId: "" }}
        onClose={() => setCreateOpen(false)}
        onSubmit={createTask}
        submitLabel="Create"
      />

      <TaskModal
        open={!!editTask}
        title="Task settings"
        groups={groups}
        initial={editTask}
        onClose={() => setEditTask(null)}
        onSubmit={(payload) => updateTask(editTask.id, payload)}
        allowDelete
        onDelete={() => deleteTask(editTask.id)}
      />

      <GroupModal
        open={createGroupOpen}
        title="New group"
        initial={{ name: "", color: "#22c55e" }}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={createGroup}
        submitLabel="Create"
      />

      <EntryModal
        open={!!createEntry}
        title={
          createEntry
            ? `Schedule • ${formatDayShort(createEntry.date)} • ${DAYS[dayIndexFromDate(createEntry.date)]} • ${formatTime(createEntry.startMin)}`
            : "Schedule"
        }
        groups={groups}
        initial={{ title: "", minutes: calendarSettings.stepMinutes, color: "#6366f1", groupId: "" }}
        onClose={() => setCreateEntry(null)}
        onSubmit={createCalendarEntry}
        submitLabel="Add"
      />

      <EntryModal
        open={!!editEntry}
        title="Scheduled entry"
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