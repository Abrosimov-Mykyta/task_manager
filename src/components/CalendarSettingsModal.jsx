import { useEffect, useMemo, useState } from "react";
import CustomSelect from "./CustomSelect";

function minutesToLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Опції для випадаючого списку: кожен slot по step хвилин
// Початок: 0:00 … 23:00 (або останній слот до 24:00)
// Кінець: перший слот після 0 … 24:00
function buildTimeOptions(stepMinutes, type) {
  const options = [];
  const max = type === "end" ? 24 * 60 : 24 * 60 - 1;
  for (let m = 0; m <= max; m += stepMinutes) {
    if (m === 24 * 60) {
      options.push({ value: 24 * 60, label: "24:00" });
      break;
    }
    const h = Math.floor(m / 60);
    const min = m % 60;
    options.push({ value: m, label: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` });
  }
  return options;
}

function snapToStep(minutes, stepMinutes) {
  return Math.round(minutes / stepMinutes) * stepMinutes;
}

export default function CalendarSettingsModal({ open, initial, onClose, onSave }) {
  const stepMinutes = initial?.stepMinutes ?? 60;
  const [startMinutes, setStartMinutes] = useState(
    snapToStep(initial?.startMinutes ?? 8 * 60, stepMinutes)
  );
  const [endMinutes, setEndMinutes] = useState(
    snapToStep(initial?.endMinutes ?? 22 * 60, stepMinutes)
  );
  const [step, setStep] = useState(stepMinutes);

  const timeOptionsStart = useMemo(() => buildTimeOptions(step, "start"), [step]);
  const timeOptionsEnd = useMemo(() => buildTimeOptions(step, "end"), [step]);

  useEffect(() => {
    if (!open) return;
    const s = initial?.stepMinutes ?? 60;
    setStep(s);
    setStartMinutes(snapToStep(initial?.startMinutes ?? 8 * 60, s));
    setEndMinutes(snapToStep(initial?.endMinutes ?? 22 * 60, s));
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

  function submit(e) {
    e.preventDefault();
    let end = endMinutes;
    if (end <= startMinutes) end = Math.min(24 * 60 - step, startMinutes + step);
    onSave?.({
      startMinutes,
      endMinutes: end,
      stepMinutes: step,
    });
    onClose?.();
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">Налаштування календаря</div>
          <button className="icon-btn icon-btn--modal" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          <label className="modal-label">
            Крок
            <CustomSelect
              className="modal-input"
              value={step}
              onChange={(v) => {
                const newStep = Number(v);
                setStep(newStep);
                setStartMinutes(snapToStep(startMinutes, newStep));
                setEndMinutes(snapToStep(endMinutes, newStep));
              }}
              options={[
                { value: 60, label: "60 хв" },
                { value: 30, label: "30 хв" },
                { value: 15, label: "15 хв" },
              ]}
            />
          </label>

          <div className="modal-grid">
            <label className="modal-label">
              Початок дня
              <CustomSelect
                className="modal-input"
                value={startMinutes}
                onChange={(v) => setStartMinutes(Number(v))}
                options={timeOptionsStart}
              />
            </label>

            <label className="modal-label">
              Кінець дня
              <CustomSelect
                className="modal-input"
                value={endMinutes}
                onChange={(v) => setEndMinutes(Number(v))}
                options={timeOptionsEnd}
              />
            </label>
          </div>

          <div className="modal-actions">
            <span />
            <button className="primary-btn" type="submit">
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
