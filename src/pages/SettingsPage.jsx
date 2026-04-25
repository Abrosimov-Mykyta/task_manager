import { useMemo, useState } from "react";
import "../App.css";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import CustomSelect from "../components/CustomSelect";
import { useSettings } from "../settings/SettingsProvider";
import { formatClock } from "../lib/formatting";
import { apiFetch } from "../lib/api";

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
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { theme, timeFormat, calendarSettings, setTheme, setTimeFormat, setCalendarSettings } =
    useSettings();

  const startOptions = useMemo(
    () => buildTimeOptions(calendarSettings.stepMinutes, "start", timeFormat),
    [calendarSettings.stepMinutes, timeFormat]
  );
  const endOptions = useMemo(
    () => buildTimeOptions(calendarSettings.stepMinutes, "end", timeFormat),
    [calendarSettings.stepMinutes, timeFormat]
  );

  async function deleteAccount() {
    const confirmed = window.confirm(
      "Delete your account permanently? This will remove all tasks, groups, and calendar entries."
    );
    if (!confirmed) return;

    setDeleteError("");
    setDeleteBusy(true);
    try {
      await apiFetch("/auth/me", { auth: true, method: "DELETE" });
      signOut();
      navigate("/register");
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete account");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">FocusOS</div>
        <div className="app-right">
          <div className="app-user-email">{user?.email}</div>
          <CustomSelect
            className="app-select"
            value="Settings"
            onChange={(v) => {
              if (v === "Calendar") navigate("/app");
              if (v === "Statistics") navigate("/stats");
              if (v === "Achievements") navigate("/achievements");
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

      <main className="settings-main">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Customize how the app looks and behaves.</p>

        <div className="settings-grid">
          <section className="settings-card">
            <h2 className="settings-card-title">Appearance</h2>
            <div className="settings-form-row">
              <label className="modal-label">
                Theme
                <CustomSelect
                  className="modal-input"
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: "neon", label: "Neon (default)" },
                    { value: "minimal", label: "Minimal" },
                  ]}
                />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Regional</h2>
            <div className="settings-form-row">
              <label className="modal-label">
                Time format
                <CustomSelect
                  className="modal-input"
                  value={timeFormat}
                  onChange={setTimeFormat}
                  options={[
                    { value: "24h", label: "24-hour" },
                    { value: "12h", label: "12-hour (AM/PM)" },
                  ]}
                />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Calendar</h2>
            <div className="settings-form-row">
              <label className="modal-label">
                Grid step
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
                    { value: 60, label: "60 min" },
                    { value: 30, label: "30 min" },
                    { value: 15, label: "15 min" },
                  ]}
                />
              </label>
            </div>
            <div className="settings-inline-grid">
              <label className="modal-label">
                Day starts at
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
                Day ends at
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

          <section className="settings-card">
            <h2 className="settings-card-title">Danger zone</h2>
            <p className="settings-subtitle" style={{ margin: "0 0 12px" }}>
              Permanently remove your account and all associated data.
            </p>
            <button
              className="danger-btn"
              type="button"
              onClick={deleteAccount}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Deleting..." : "Delete account"}
            </button>
            {deleteError ? <div className="modal-error" style={{ marginTop: 10 }}>{deleteError}</div> : null}
          </section>
        </div>
      </main>
    </div>
  );
}
