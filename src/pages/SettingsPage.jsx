import { useMemo } from "react";
import "../App.css";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import CustomSelect from "../components/CustomSelect";
import { useSettings } from "../settings/SettingsProvider";
import { formatClock } from "../lib/formatting";

function buildTimeOptions(stepMinutes, type, timeFormat) {
  const options = [];
  const max = type === "end" ? 24 * 60 : 24 * 60 - 1;
  for (let m = 0; m <= max; m += stepMinutes) {
    if (m === 24 * 60) {
      options.push({ value: 24 * 60, label: timeFormat === "12h" ? "12:00 AM (+1 day)" : "24:00" });
      break;
    }
    options.push({ value: m, label: formatClock(m, timeFormat) });
  }
  return options;
}

function snapToStep(minutes, stepMinutes) {
  return Math.round(minutes / stepMinutes) * stepMinutes;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    theme,
    language,
    timeFormat,
    calendarSettings,
    setTheme,
    setLanguage,
    setTimeFormat,
    setCalendarSettings,
  } = useSettings();

  const startOptions = useMemo(
    () => buildTimeOptions(calendarSettings.stepMinutes, "start", timeFormat),
    [calendarSettings.stepMinutes, timeFormat]
  );
  const endOptions = useMemo(
    () => buildTimeOptions(calendarSettings.stepMinutes, "end", timeFormat),
    [calendarSettings.stepMinutes, timeFormat]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">FocusOS</div>
        <div className="app-right">
          <div style={{ fontSize: 12, color: "rgba(229,231,235,0.7)" }}>{user?.email}</div>
          <CustomSelect
            className="app-select"
            value="Налаштування"
            onChange={(v) => {
              if (v === "Календар") navigate("/app");
              if (v === "Статистика") navigate("/stats");
              if (v === "Досягнення") navigate("/achievements");
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

      <main className="settings-main">
        <h1 className="settings-title">Налаштування</h1>
        <p className="settings-subtitle">Персоналізуй вигляд та поведінку застосунку.</p>

        <div className="settings-grid">
          <section className="settings-card">
            <h2 className="settings-card-title">Стиль застосунку</h2>
            <div className="settings-form-row">
              <label className="modal-label">
                Тема
                <CustomSelect
                  className="modal-input"
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: "neon", label: "Neon (поточна)" },
                    { value: "classic", label: "Classic (аристократичний)" },
                    { value: "minimal", label: "Minimal" },
                  ]}
                />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Локалізація</h2>
            <div className="settings-form-row">
              <label className="modal-label">
                Мова інтерфейсу
                <CustomSelect
                  className="modal-input"
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: "uk", label: "Українська" },
                    { value: "en", label: "English" },
                  ]}
                />
              </label>
            </div>
            <div className="settings-form-row">
              <label className="modal-label">
                Формат часу
                <CustomSelect
                  className="modal-input"
                  value={timeFormat}
                  onChange={setTimeFormat}
                  options={[
                    { value: "24h", label: "24-годинний" },
                    { value: "12h", label: "12-годинний (AM/PM)" },
                  ]}
                />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Календар</h2>
            <div className="settings-form-row">
              <label className="modal-label">
                Крок
                <CustomSelect
                  className="modal-input"
                  value={calendarSettings.stepMinutes}
                  onChange={(v) => {
                    const stepMinutes = Number(v);
                    const startMinutes = snapToStep(calendarSettings.startMinutes, stepMinutes);
                    const endMinutes = Math.max(
                      startMinutes + stepMinutes,
                      snapToStep(calendarSettings.endMinutes, stepMinutes)
                    );
                    setCalendarSettings({ startMinutes, endMinutes, stepMinutes });
                  }}
                  options={[
                    { value: 60, label: "60 хв" },
                    { value: 30, label: "30 хв" },
                    { value: 15, label: "15 хв" },
                  ]}
                />
              </label>
            </div>
            <div className="settings-inline-grid">
              <label className="modal-label">
                Початок дня
                <CustomSelect
                  className="modal-input"
                  value={calendarSettings.startMinutes}
                  onChange={(v) =>
                    setCalendarSettings({
                      ...calendarSettings,
                      startMinutes: Number(v),
                    })
                  }
                  options={startOptions}
                />
              </label>
              <label className="modal-label">
                Кінець дня
                <CustomSelect
                  className="modal-input"
                  value={calendarSettings.endMinutes}
                  onChange={(v) =>
                    setCalendarSettings({
                      ...calendarSettings,
                      endMinutes: Number(v),
                    })
                  }
                  options={endOptions}
                />
              </label>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

