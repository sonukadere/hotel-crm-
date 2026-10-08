/**
 * Authorized HTTP client for the CRM (PMS staff) app.
 *
 * Every request attaches the session access token and, on 401, clears the
 * session so the app returns to the login screen.
 */

export const API_BASE = "http://localhost:4000/api";

const TOKEN_KEY = "pms.access.token";
export const UNAUTHORIZED_EVENT = "pms:unauthorized";
export const LOGGED_IN_EVENT = "pms:logged-in";

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable (e.g. private mode) - token lives in memory only */
  }
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
}

export function notifyLoggedIn(): void {
  window.dispatchEvent(new CustomEvent(LOGGED_IN_EVENT));
}

/**
 * drop-in `fetch` replacement: resolves the base URL, attaches the bearer
 * token, then returns the raw Response so callers keep using res.ok/res.json().
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = /^(https?:)?\/\//i.test(input) ? input : `${API_BASE}${input.startsWith("/") ? input : `/${input}`}`;
  const token = getAccessToken();

  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401 && !url.includes("/auth/login")) {
    clearAccessToken();
    notifyUnauthorized();
  }
  return response;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  errors?: string[];
  data: T;
}

export async function authJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(input, init);
  let payload: ApiEnvelope<T> | null = null;
  try {
    const json = (await response.json()) as { success?: boolean; message?: string; errors?: string[]; data?: T };
    if (json && typeof json.success === "boolean") payload = json as ApiEnvelope<T>;
  } catch {
    payload = null;
  }
  if (!response.ok || !payload || payload.success !== true) {
    const message =
      payload?.message || (Array.isArray(payload?.errors) && payload.errors.length > 0 ? payload.errors.join(", ") : `Request failed (${response.status})`);
    const error = new Error(message) as Error & { status: number; errors: string[] };
    error.status = response.status;
    error.errors = payload?.errors ?? [message];
    throw error;
  }
  return payload.data;
}