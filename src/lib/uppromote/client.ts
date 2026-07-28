// Server-only UpPromote Public API v2 client.
//
// Docs: https://aff-api.uppromote.com/docs/v2/api-overview-1615961m0
//   - Base URL https://aff-api.uppromote.com/api/v2
//   - Auth: the raw API key in the Authorization header (no "Bearer" prefix
//     per the v2 docs; we send both forms accepted patterns via the raw key)
//   - Rate limit: 120 requests/minute per store
//
// The key lives ONLY in the UPPROMOTE_API_KEY env var. Never import this
// module from client components.

const DEFAULT_BASE = "https://aff-api.uppromote.com/api/v2";
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

export function uppromoteConfigured(): boolean {
  return Boolean(process.env.UPPROMOTE_API_KEY);
}

export function uppromoteBaseUrl(): string {
  return (process.env.UPPROMOTE_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

export class UppromoteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** GET a v2 endpoint with timeout + retry/backoff (429 and 5xx retry). */
export async function upGet(
  path: string,
  params: Record<string, string | number> = {}
): Promise<unknown> {
  const key = process.env.UPPROMOTE_API_KEY;
  if (!key) throw new UppromoteError("UpPromote is not configured.", 503);

  const url = new URL(`${uppromoteBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let lastError: UppromoteError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: key, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        lastError = new UppromoteError(`UpPromote responded ${res.status}.`, res.status);
        if (retryAfter > 0 && retryAfter <= 60) await sleep(retryAfter * 1000);
        continue;
      }
      if (!res.ok) {
        // 4xx (other than 429): not retryable — bad key, bad path, plan-gated.
        throw new UppromoteError(`UpPromote responded ${res.status} for ${path}.`, res.status);
      }
      return (await res.json()) as unknown;
    } catch (e) {
      if (e instanceof UppromoteError && e.status !== 429 && e.status < 500) throw e;
      lastError =
        e instanceof UppromoteError
          ? e
          : new UppromoteError(e instanceof Error ? e.message : "Network error", 0);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new UppromoteError("UpPromote request failed.", 0);
}

/**
 * Extract the row array from a v2 list response without assuming the exact
 * envelope (the docs gate automated access, so the shape is confirmed at
 * runtime): accepts a bare array, {data: [...]}, or {data: {data: [...]}}.
 */
export function listRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === "object") {
    const data = (body as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (data && typeof data === "object") {
      const inner = (data as Record<string, unknown>).data;
      if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
  }
  return [];
}

/** Read a numeric pagination hint (e.g. last_page) from a list envelope. */
function pageHint(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object") return null;
  const top = (body as Record<string, unknown>)[key];
  if (typeof top === "number") return top;
  for (const nested of ["meta", "data"]) {
    const inner = (body as Record<string, unknown>)[nested];
    if (inner && typeof inner === "object") {
      const v = (inner as Record<string, unknown>)[key];
      if (typeof v === "number") return v;
    }
  }
  return null;
}

/**
 * Page through a list endpoint until it's exhausted. The server may ignore
 * our page-size parameter (observed: /affiliates returns 10/page regardless),
 * so never stop on "short page" — stop on the envelope's last_page when
 * present, an empty page, or a page of already-seen rows (guards against
 * servers that ignore `page` too). Caps at maxPages as a backstop.
 */
export async function upGetAll(
  path: string,
  opts: { limit?: number; maxPages?: number; extraParams?: Record<string, string | number> } = {}
): Promise<Record<string, unknown>[]> {
  const limit = opts.limit ?? 100;
  const maxPages = opts.maxPages ?? 200;
  const all: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= maxPages; page++) {
    // Send both common page-size spellings; extras are harmless.
    const body = await upGet(path, { ...opts.extraParams, page, limit, per_page: limit });
    const rows = listRows(body);
    if (rows.length === 0) break;
    let fresh = 0;
    for (const row of rows) {
      const key = String(row.id ?? JSON.stringify(row));
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(row);
      fresh++;
    }
    if (fresh === 0) break; // server ignored `page` — same rows again
    const lastPage = pageHint(body, "last_page");
    if (lastPage !== null && page >= lastPage) break;
    const total = pageHint(body, "total");
    if (total !== null && all.length >= total) break;
    // Stay well under the 120 req/min store-wide limit.
    await new Promise((r) => setTimeout(r, 600));
  }
  return all;
}
