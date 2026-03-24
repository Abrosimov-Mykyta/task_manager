import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadCalendarSettings, saveCalendarSettings } from "../lib/calendarSettings";

const KEY = "tm_user_settings_v1";

const DEFAULTS = {
  theme: "neon",
  language: "uk",
  timeFormat: "24h",
};

const SettingsContext = createContext(null);

function loadUserSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      theme: ["neon", "classic", "minimal"].includes(parsed.theme) ? parsed.theme : "neon",
      language: ["uk", "en"].includes(parsed.language) ? parsed.language : "uk",
      timeFormat: ["24h", "12h"].includes(parsed.timeFormat) ? parsed.timeFormat : "24h",
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }) {
  const [userSettings, setUserSettings] = useState(loadUserSettings);
  const [calendarSettings, setCalendarSettings] = useState(loadCalendarSettings);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(userSettings));
  }, [userSettings]);

  useEffect(() => {
    saveCalendarSettings(calendarSettings);
  }, [calendarSettings]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", userSettings.theme);
    document.documentElement.setAttribute("data-language", userSettings.language);
    document.documentElement.setAttribute("data-time-format", userSettings.timeFormat);
  }, [userSettings.theme, userSettings.language, userSettings.timeFormat]);

  const value = useMemo(
    () => ({
      theme: userSettings.theme,
      language: userSettings.language,
      timeFormat: userSettings.timeFormat,
      calendarSettings,
      setTheme: (theme) => setUserSettings((prev) => ({ ...prev, theme })),
      setLanguage: (language) => setUserSettings((prev) => ({ ...prev, language })),
      setTimeFormat: (timeFormat) => setUserSettings((prev) => ({ ...prev, timeFormat })),
      setCalendarSettings,
    }),
    [userSettings, calendarSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider />");
  return ctx;
}

