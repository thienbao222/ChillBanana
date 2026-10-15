// Client HTTP tối giản cho E2E: dùng fetch thuần, KHÔNG có cookie jar nên mỗi lệnh gọi
// chỉ mang đúng cookie ta truyền vào (quan trọng khi kiểm tra phân quyền).
export const E2E_PORT = 3100;
export const BASE = `http://127.0.0.1:${E2E_PORT}`;

type Opts = { json?: unknown; cookie?: string; headers?: Record<string, string> };

export type HttpResult = {
  status: number;
  data: any;
  /** Các cookie đặt bởi server, dạng "a=1; b=2" để truyền lại vào Opts.cookie */
  cookie: string;
};

export async function http(method: string, path: string, opts: Opts = {}): Promise<HttpResult> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* không phải JSON */
  }
  return {
    status: res.status,
    data,
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}

export const api = {
  get: (path: string, opts?: Opts) => http("GET", path, opts),
  post: (path: string, json?: unknown, opts: Opts = {}) => http("POST", path, { ...opts, json }),
  patch: (path: string, json?: unknown, opts: Opts = {}) => http("PATCH", path, { ...opts, json }),
};
