import { useEffect, useState } from "react";

export default function GroupModal({ open, title, initial, onClose, onSubmit, submitLabel = "Зберегти" }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#22c55e");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setColor(initial?.color ?? "#22c55e");
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
      await onSubmit?.({ name: name.trim(), color });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Не вдалось зберегти групу.");
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
            Назва групи
            <input
              className="modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: Робота"
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

          {error ? <div className="modal-error">{error}</div> : null}

          <div className="modal-actions">
            <span />
            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Зберігаємо..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

