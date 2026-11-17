#!/usr/bin/env node
/**
 * check-gemini.mjs - Kiểm tra khóa API và model Gemini của dự án ChillBanana.
 * Chạy ở thư mục gốc dự án:   node check-gemini.mjs
 * Thêm model muốn thử:        node check-gemini.mjs --models=gemini-3.5-flash,gemini-3.1-flash-lite
 * Script KHÔNG in khóa đầy đủ (chỉ 4 ký tự cuối).
 */
import fs from "node:fs";

// ---- đọc .env (không cần cài dotenv) ----
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(".env.local");
loadEnv(".env");

const VARS = ["GEMINI_CHAT_KEYS", "GEMINI_SCRAPE_KEYS", "GEMINI_VISION_KEYS", "GEMINI_ADMIN_KEYS", "GEMINI_API_KEY", "GOOGLE_API_KEY"];
const keyUse = new Map(); // key -> Set(tên biến)
let totalEntries = 0;
for (const name of VARS) {
  for (const k of (process.env[name] || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    totalEntries++;
    if (!keyUse.has(k)) keyUse.set(k, new Set());
    keyUse.get(k).add(name);
  }
}
const tail = (k) => "..." + k.slice(-4);
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const short = (s) => String(s).replace(/\s+/g, " ").slice(0, 140);

async function call(url, body) {
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, ok: res.ok, json, text };
  } catch (e) {
    return { status: 0, ok: false, json: null, text: String(e?.message || e) };
  }
}

async function main() {
  if (keyUse.size === 0) {
    console.log("❌ Không tìm thấy khóa nào trong .env (GEMINI_CHAT_KEYS, GEMINI_API_KEY...).");
    process.exit(1);
  }
  console.log(`\n1) KHÓA: ${totalEntries} mục khai báo nhưng chỉ có ${keyUse.size} khóa KHÁC NHAU`);
  const keys = [...keyUse.keys()];
  for (const k of keys) {
    const r = await call(`${BASE}/models?pageSize=1&key=${k}`);
    const msg = r.ok ? "hợp lệ" : short(r.json?.error?.message || r.text);
    console.log(`   ${tail(k)}  dùng ở: ${[...keyUse.get(k)].join(", ")}  ->  HTTP ${r.status} ${msg}`);
  }

  const key = keys[0];
  console.log(`\n2) MODEL mà khóa ${tail(key)} thấy được (có generateContent, tên chứa "flash"):`);
  let names = [];
  let token = "";
  for (let i = 0; i < 5; i++) {
    const r = await call(`${BASE}/models?pageSize=200${token ? "&pageToken=" + token : ""}&key=${key}`);
    if (!r.ok) { console.log(`   ❌ ListModels lỗi HTTP ${r.status}: ${short(r.json?.error?.message || r.text)}`); break; }
    for (const m of r.json.models || []) {
      if ((m.supportedGenerationMethods || []).includes("generateContent") && /flash/i.test(m.name)) names.push(m.name.replace("models/", ""));
    }
    token = r.json.nextPageToken || "";
    if (!token) break;
  }
  names = [...new Set(names)].sort();
  console.log("   " + (names.join("\n   ") || "(không có)"));

  const extra = (process.argv.find((a) => a.startsWith("--models=")) || "").replace("--models=", "").split(",").filter(Boolean);
  const current = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const auto = names.filter((n) => /^gemini-3/.test(n) && !/preview|image|live|tts|audio/.test(n)).slice(0, 4);
  const toTest = [...new Set([...current, ...extra, ...auto])];

  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  console.log(`\n3) THỬ GỌI THẬT (văn bản + ảnh) với khóa ${tail(key)}:`);
  console.log("   model".padEnd(36) + "văn bản".padEnd(14) + "ảnh (Vision)");
  for (const model of toTest) {
    const url = `${BASE}/models/${model}:generateContent?key=${key}`;
    const t = await call(url, { contents: [{ parts: [{ text: "Trả lời đúng một từ: OK" }] }], generationConfig: { maxOutputTokens: 200 } });
    const v = await call(url, { contents: [{ parts: [{ inlineData: { mimeType: "image/png", data: PNG } }, { text: 'Trả về JSON {"ok":true}' }] }], generationConfig: { maxOutputTokens: 200, responseMimeType: "application/json" } });
    const flag = (r) => (r.ok ? "OK 200" : `LỖI ${r.status}`);
    console.log("   " + model.padEnd(33) + flag(t).padEnd(14) + flag(v) + (!t.ok ? "   " + short(t.json?.error?.message || t.text).slice(0, 70) : ""));
  }
  console.log("\nĐọc kết quả: model nào 'LỖI 404' là đã ngừng/không tồn tại; 'LỖI 429' là hết hạn mức; 'OK 200' là dùng được.");
}
main();
