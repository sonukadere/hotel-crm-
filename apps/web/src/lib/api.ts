/**
 * Thin client for the public booking API. Every amount shown on this site is
 * produced by the API - the browser never calculates a payable price.
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 12_000;

export interface Envelope<T> {
  success: boolean;
  message?: string;
  errors?: string[];
  data: T;
  timestamp: string;
}

export class ApiError extends Error {
  status: number;
  errors: string[];

  constructor(message: string, status: number, errors: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors.length > 0 ? errors : [message];
  }
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, headers, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
      signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(timeoutMs)
        : undefined,
    });
  } catch {
    throw new ApiError(
      "We could not reach the reservation desk. Please try again in a moment.",
      503,
    );
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.success !== true) {
    throw new ApiError(
      payload?.message || "Something went wrong. Please try again.",
      response.status,
      payload?.errors ?? [],
    );
  }

  return payload.data;
}

export function apiGet<T>(
  path: string,
  params: Record<string, string | number | undefined | null> = {},
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  return request<T>(`${path}${buildQuery(params)}`, { ...init, method: "GET" });
}

export function apiPost<T>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...init.headers },
    body: JSON.stringify(body ?? {}),
  });
}
