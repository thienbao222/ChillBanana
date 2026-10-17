import { NextRequest } from "next/server";

type Opts = {
  json?: unknown;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  ip?: string;
};

export function makeRequest(method: string, path: string, opts: Opts = {}): NextRequest {
  const headers = new Headers(opts.headers);
  if (opts.json !== undefined) headers.set("content-type", "application/json");
  if (opts.ip) headers.set("x-forwarded-for", opts.ip);
  if (opts.cookies && Object.keys(opts.cookies).length > 0) {
    headers.set(
      "cookie",
      Object.entries(opts.cookies)
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join("; ")
    );
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
}

export const get = (path: string, opts?: Opts) => makeRequest("GET", path, opts);
export const post = (path: string, json?: unknown, opts: Opts = {}) => makeRequest("POST", path, { ...opts, json });
export const patch = (path: string, json?: unknown, opts: Opts = {}) => makeRequest("PATCH", path, { ...opts, json });
export const put = (path: string, json?: unknown, opts: Opts = {}) => makeRequest("PUT", path, { ...opts, json });
export const del = (path: string, opts?: Opts) => makeRequest("DELETE", path, opts);

/** Tham số động của route Next.js 15 (params là Promise). */
export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

/** Lấy giá trị cookie (đã giải mã) từ header Set-Cookie của phản hồi. */
export function cookieFrom(res: Response, name: string): string | undefined {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0 && pair.slice(0, idx).trim() === name) {
      const raw = pair.slice(idx + 1);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

export const json = async <T = any>(res: Response): Promise<T> => (await res.json()) as T;
