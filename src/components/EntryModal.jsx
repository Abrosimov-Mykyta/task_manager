import { useEffect, useMemo, useState } from "react";
import CustomSelect from "./CustomSelect";

function clampMinutes(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  return Math.max(5, Math.min(24 * 60, Math.round(n)));
}

export default function EntryModal({
  open,
  title,
  initial,
  groups,
  onClose,
  onSubmit,
  submitLabel = "Зберегти",
  allowDelete = false,
  onDelete,
}) {
  const groupOptions = useMemo(() => groups ?? [], [groups]);
  const [entryTitle, setEntryTitle] = useState(initial?.title ?? "");
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30);
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEntryTitle(initial?.title ?? "");
    setMinutes(initial?.minutes ?? 30);
    setColor(initial?.color ?? "#6366f1");
    setGroupId(initial?.groupId ?? "");
    setSubmitting(false);
    setError("");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit?.({
        title: entryTitle.trim(),
        minutes: clampMinutes(minutes),
        color,
        groupId: groupId || null,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Не вдалось зберегти.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!allowDelete || !onDelete) return;
    setError("");
    setSubmitting(true);
    try {
      await onDelete();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Не вдалось видалити.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="modal-label">
            Назва
            <input
              className="modal-input"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Наприклад: Дзвінок"
              required
            />
          </label>

          <div className="modal-grid">
            <label className="modal-label">
              Тривалість (хв)
              <input
                className="modal-input"
                type="number"
                min={5}
                max={1440}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                required
              />
            </label>

            <label className="modal-label">
              Колір
              <input
                className="modal-input"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ height: 42, padding: 6 }}
              />
            </label>
          </div>

          <label className="modal-label">
            Група
            <CustomSelect
              className="modal-input"
              value={groupId || ""}
              onChange={(v) => {
                setGroupId(v);
                const g = groupOptions.find((gr) => gr.id === v);
                if (g?.color) setColor(g.color);
              }}
              options={[
                { value: "", label: "Без групи" },
                ...groupOptions.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </label>

          {error ? <div className="modal-error">{error}</div> : null}

          <div className="modal-actions">
            {allowDelete ? (
              <button className="danger-btn" type="button" onClick={handleDelete} disabled={submitting}>
                Видалити
              </button>
            ) : (
              <span />
            )}
            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Зберігаємо..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

