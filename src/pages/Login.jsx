import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch, setToken } from "../lib/api";
import "./auth.css";

export default function LoginPage() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = useMemo(() => location.state?.from?.pathname ?? "/app", [location]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.data?.error || err?.message || "";
      if (err?.status === 401) {
        setError("Невірний email або пароль. Перевірте дані й спробуйте знову.");
      } else if (err?.status === 400) {
        setError(msg === "Invalid payload" ? "Пароль має бути щонайменше 6 символів." : msg || "Перевірте введені дані.");
      } else if (msg) {
        setError(msg);
      } else {
        setError("Не вдалося підключитися до сервера. Перевірте, що сервер запущено (npm run dev у папці server).");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">Увійти</h1>
        <p className="auth-subtitle">Email + пароль (класика).</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-label">
            Пароль
            <input
              className="auth-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <div className="auth-actions">
            <button className="auth-primary" type="submit" disabled={submitting}>
              {submitting ? "Входимо..." : "Увійти"}
            </button>
          </div>
        </form>

        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        <div className="auth-link">
          Нема акаунта? <Link to="/register">Зареєструватись</Link>
        </div>
      </div>
    </div>
  );
}

