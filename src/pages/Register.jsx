import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch, setToken } from "../lib/api";
import "./auth.css";

export default function RegisterPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password !== password2) {
      setError("Паролі не співпадають.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      setInfo("Акаунт створено. Можеш продовжувати.");
      navigate("/app", { replace: true });
    } catch {
      setError("Registration failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">Реєстрація</h1>
        <p className="auth-subtitle">Створимо твій простір задач.</p>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <label className="auth-label">
            Повтори пароль
            <input
              className="auth-input"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <div className="auth-actions">
            <button className="auth-primary" type="submit" disabled={submitting}>
              {submitting ? "Створюємо..." : "Зареєструватись"}
            </button>
          </div>
        </form>

        {error ? <div className="auth-error">{error}</div> : null}
        {info ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(229,231,235,0.75)" }}>
            {info}
          </div>
        ) : null}

        <div className="auth-link">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </div>
      </div>
    </div>
  );
}

