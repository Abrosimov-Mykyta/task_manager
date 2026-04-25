const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken() {
  return localStorage.getItem("tm_token");
}

export function setToken(token) {
  if (!token) localStorage.removeItem("tm_token");
  else localStorage.setItem("tm_token", token);
}

export async function apiFetch(path, { auth = false, ...init } = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");

  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const fallbackMessage = text && !data ? text.slice(0, 180) : `Request failed (${res.status})`;
    const message = data?.error || data?.message || fallbackMessage;
    const err = new Error(message);
    err.status = res.status;
    err.data = data ?? text ?? null;
    throw err;
  }

  return data;
}

