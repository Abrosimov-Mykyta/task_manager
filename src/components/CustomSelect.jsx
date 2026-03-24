import { useEffect, useMemo, useRef, useState } from "react";

export default function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  menuClassName = "",
  disabled = false,
  placeholder = "Оберіть",
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  );

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick, true);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick, true);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div
      className={`custom-select ${disabled ? "is-disabled" : ""}${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`custom-select-trigger ${className}`.trim()}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{selected?.label ?? placeholder}</span>
      </button>

      {open ? (
        <div className={`custom-select-menu ${menuClassName}`.trim()} role="listbox">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`custom-select-option${isSelected ? " is-selected" : ""}`}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange?.(opt.value);
                  setOpen(false);
                }}
                disabled={!!opt.disabled}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

