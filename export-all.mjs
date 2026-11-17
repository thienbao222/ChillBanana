#!/usr/bin/env node
/**
 * export-all.mjs  -  Gom TOÀN BỘ mã nguồn dự án thành các file .txt cho Gemini đọc.
 *
 * Cách dùng (chạy ở thư mục gốc dự án):
 *   node export-all.mjs                 # mặc định: mỗi phần <= 200 KB
 *   node export-all.mjs --max-kb=100    # chia nhỏ hơn
 *   node export-all.mjs --out=my-chunks # đổi thư mục xuất
 *
 * Tự động:
 *  - Quét file bằng `git ls-files` (tôn trọng .gitignore). Không có git thì tự duyệt thư mục.
 *  - Bỏ file nhị phân, lockfile, node_modules, .next, .env (bí mật), ảnh, font...
 *  - Nhóm theo khu vực (config, db, lib, features/<x>, api/<x>, pages, components, tests, docs).
 *  - File quá lớn được cắt theo dòng thành nhiều phần, không mất chữ.
 *  - Sinh 00-tree.txt (cây thư mục) và 00-manifest.txt (file nào nằm ở phần nào, file nào bị bỏ).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ---------- Cấu hình ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, args.out || "codebase-chunks");
const LIMIT_BYTES = (Number(args["max-kb"]) || 200) * 1024;
const MAX_BYTES = LIMIT_BYTES - 4096; // chừa chỗ cho phần tiêu đề + danh sách file của mỗi phần
const DATA_FILE_MAX_LINES = Number(args["data-lines"]) || 150; // file dữ liệu .json lớn chỉ lấy đầu

const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out", "coverage", ".turbo",
  ".vercel", ".cache", "playwright-report", "test-results", ".idea", ".vscode",
  path.basename(OUT_DIR),
]);
const IGNORE_FILES = new Set([
  "export-all.mjs", "export-codebase.mjs", "export-supplementary.mjs",
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", ".DS_Store",
  "next-env.d.ts", "tsconfig.tsbuildinfo",
]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".prisma",
  ".css", ".scss", ".sql", ".yml", ".yaml", ".html", ".txt", ".sh", ".toml",
  ".graphql", ".gql", ".svg",
]);
const TEXT_NAMES = new Set(["Dockerfile", ".gitignore", ".env.example", ".env.sample", ".eslintrc", ".prettierrc"]);
const SECRET_PATTERNS = [/^\.env(\..+)?$/i, /\.pem$/i, /\.key$/i, /\.p12$/i, /id_rsa/i, /service-account.*\.json$/i];
const SAFE_ENV = new Set([".env.example", ".env.sample"]);
const DATA_JSON_KEEP_FULL = /^(package|tsconfig|jsconfig|vercel|components|\.eslintrc|playwright|vitest)[^/]*\.json$/i;

// ---------- Thu thập file ----------
function listFilesGit() {
  try {
    const out = execSync("git ls-files -co --exclude-standard", {
      cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) walk(path.join(dir, e.name), acc);
    } else acc.push(path.relative(ROOT, path.join(dir, e.name)));
  }
  return acc;
}

const skipped = []; // {file, reason}
function shouldInclude(rel) {
  const norm = rel.split(path.sep).join("/");
  const parts = norm.split("/");
  const base = parts[parts.length - 1];
  if (parts.some((p) => IGNORE_DIRS.has(p))) return false; // bỏ lặng lẽ
  if (IGNORE_FILES.has(base)) return false;
  if (SECRET_PATTERNS.some((r) => r.test(base)) && !SAFE_ENV.has(base)) {
    skipped.push({ file: norm, reason: "nghi chứa bí mật (không xuất)" });
    return false;
  }
  if (/\.min\.(js|css)$|\.map$|\.d\.ts$/.test(base)) return false;
  const ext = path.extname(base).toLowerCase();
  if (!TEXT_EXT.has(ext) && !TEXT_NAMES.has(base)) {
    return false; // ảnh, font, nhị phân...
  }
  return true;
}

// ---------- Phân nhóm ----------
function groupOf(f) {
  const p = f.split(path.sep).join("/");
  const m = (re) => p.match(re);
  if (!p.includes("/") || /^(next|tailwind|postcss|eslint|vitest|playwright|vite)\./.test(p)) return ["00", "config"];
  if (p.startsWith("prisma/")) return ["01", "database"];
  if (p.startsWith("docs/") || /\.mdx?$/.test(p)) return ["02", "docs"];
  if (p.startsWith("src/types")) return ["03", "types"];
  if (p.startsWith("src/lib/")) return ["04", "lib"];
  let x;
  if ((x = m(/^src\/features\/([^/]+)/))) return ["05", `features-${x[1]}`];
  if ((x = m(/^src\/app\/api\/([^/]+)/))) return ["06", `api-${x[1]}`];
  if (p.startsWith("src/context/") || p.startsWith("src/hooks/")) return ["07", "context-hooks"];
  if (p.startsWith("src/components/")) return ["08", "components"];
  if (p.startsWith("src/app/")) return ["09", "pages"];
  if (p.startsWith("tests/") || /\.(test|spec)\.[tj]sx?$/.test(p)) return ["10", "tests"];
  if (p.startsWith("scripts/")) return ["11", "scripts"];
  if (p.startsWith("src/")) return ["12", "src-other"];
  return ["13", "other"];
}

// ---------- Đọc & cắt file ----------
const BLOCK_HEAD = (f, note = "") =>
  `\n================================================================\nFILE: ${f}${note}\n================================================================\n\n`;

function readUnits(rel) {
  const norm = rel.split(path.sep).join("/");
  let text;
  try {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    if (buf.includes(0)) { skipped.push({ file: norm, reason: "nhị phân" }); return []; }
    text = buf.toString("utf8");
  } catch {
    skipped.push({ file: norm, reason: "không đọc được" });
    return [];
  }
  const base = path.basename(norm);
  if (/\.json$/i.test(base) && !DATA_JSON_KEEP_FULL.test(base)) {
    const lines = text.split("\n");
    if (lines.length > DATA_FILE_MAX_LINES) {
      text = lines.slice(0, DATA_FILE_MAX_LINES).join("\n") +
        `\n... [ĐÃ CẮT: file dữ liệu ${lines.length} dòng, chỉ lấy ${DATA_FILE_MAX_LINES} dòng đầu làm mẫu cấu trúc]\n`;
    }
  }
  const whole = BLOCK_HEAD(norm) + text + "\n";
  if (Buffer.byteLength(whole) <= MAX_BYTES) return [{ file: norm, body: whole, note: "" }];

  // file lớn: cắt theo dòng
  const lines = text.split("\n");
  const chunks = [];
  let cur = [], size = 0;
  for (const ln of lines) {
    const b = Buffer.byteLength(ln) + 1;
    if (size + b > MAX_BYTES - 400 && cur.length) { chunks.push(cur.join("\n")); cur = []; size = 0; }
    cur.push(ln); size += b;
  }
  if (cur.length) chunks.push(cur.join("\n"));
  return chunks.map((c, i) => {
    const note = ` (phần ${i + 1}/${chunks.length}, file quá lớn nên được chia)`;
    return { file: norm, body: BLOCK_HEAD(norm, note) + c + "\n", note };
  });
}

// ---------- Cây thư mục ----------
function buildTree(files) {
  const root = {};
  for (const f of files) {
    let node = root;
    for (const part of f.split("/")) node = node[part] ??= {};
  }
  const lines = [];
  (function render(node, prefix) {
    const keys = Object.keys(node).sort((a, b) => {
      const da = Object.keys(node[a]).length > 0, db = Object.keys(node[b]).length > 0;
      return da === db ? a.localeCompare(b) : da ? -1 : 1;
    });
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      lines.push(prefix + (last ? "└── " : "├── ") + k);
      render(node[k], prefix + (last ? "    " : "│   "));
    });
  })(root, "");
  return lines.join("\n");
}

// ---------- Main ----------
function main() {
  const raw = listFilesGit() ?? walk(ROOT);
  const usingGit = listFilesGit() !== null;
  const files = [...new Set(raw)].filter(shouldInclude).sort((a, b) => {
    const [ga, gb] = [groupOf(a), groupOf(b)];
    return ga[0] === gb[0] && ga[1] === gb[1] ? a.localeCompare(b) : (ga[0] + ga[1]).localeCompare(gb[0] + gb[1]);
  });

  if (!files.length) { console.error("❌ Không tìm thấy file nào. Hãy chạy script ở thư mục gốc dự án."); process.exit(1); }

  // dọn thư mục xuất
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^(part-|supplement-|00-)/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  // gói thành các phần, không để nhóm này lẫn nhóm kia nếu phần hiện tại đã đầy > 50%
  const parts = []; // {groups:Set, units:[], bytes}
  let cur = { groups: new Set(), units: [], bytes: 0 };
  let lastGroup = null;
  const flush = () => { if (cur.units.length) parts.push(cur); cur = { groups: new Set(), units: [], bytes: 0 }; };

  for (const f of files) {
    const g = groupOf(f)[1];
    for (const u of readUnits(f)) {
      const b = Buffer.byteLength(u.body);
      const groupChanged = lastGroup !== null && g !== lastGroup;
      if (cur.units.length && (cur.bytes + b > MAX_BYTES || (groupChanged && cur.bytes > MAX_BYTES * 0.5))) flush();
      cur.units.push(u); cur.bytes += b; cur.groups.add(g);
      lastGroup = g;
    }
  }
  flush();

  // ghi các phần
  const manifestRows = [];
  const total = parts.length;
  const pad = String(total).length < 2 ? 2 : String(total).length;
  parts.forEach((p, i) => {
    const n = String(i + 1).padStart(pad, "0");
    const slug = [...p.groups].slice(0, 3).join("+").replace(/[^a-z0-9+\-]/gi, "").slice(0, 60);
    const name = `part-${n}-${slug}.txt`;
    const uniqueFiles = [...new Set(p.units.map((u) => u.file))];
    let content = `# Codebase - PART ${i + 1}/${total}: ${[...p.groups].join(", ")}\n`;
    content += `# Đây là một phần của toàn bộ mã nguồn. Xem 00-manifest.txt để biết các phần khác.\n\n`;
    content += `## FILES IN THIS PART:\n` + uniqueFiles.map((f) => `- ${f}`).join("\n") + "\n";
    content += p.units.map((u) => u.body).join("");
    fs.writeFileSync(path.join(OUT_DIR, name), content, "utf8");
    const kb = (Buffer.byteLength(content) / 1024).toFixed(1);
    p.units.forEach((u) => manifestRows.push({ file: u.file, part: name, note: u.note }));
    console.log(`   -> [${i + 1}/${total}] ${name} : ${kb} KB (${uniqueFiles.length} tệp)`);
  });

  // cây + manifest
  const tree = buildTree(files.map((f) => f.split(path.sep).join("/")));
  fs.writeFileSync(path.join(OUT_DIR, "00-tree.txt"),
    `# Cây thư mục các file đã được đưa vào (${files.length} file)\n\n${tree}\n`, "utf8");

  let manifest = `# MANIFEST - ${files.length} file mã nguồn trong ${total} phần (nguồn: ${usingGit ? "git ls-files" : "duyệt thư mục"})\n\n`;
  manifest += `## FILE -> PART\n` + manifestRows.map((r) => `${r.file}  ->  ${r.part}${r.note}`).join("\n") + "\n";
  if (skipped.length) {
    manifest += `\n## FILE BỊ BỎ QUA\n` + skipped.map((s) => `${s.file}  (${s.reason})`).join("\n") + "\n";
  }
  fs.writeFileSync(path.join(OUT_DIR, "00-manifest.txt"), manifest, "utf8");

  const totalBytes = parts.reduce((s, p) => s + p.bytes, 0);
  console.log(`\n✅ Xong: ${files.length} file -> ${total} phần + 00-tree.txt + 00-manifest.txt`);
  console.log(`   📂 ${OUT_DIR}`);
  console.log(`   📊 Tổng ~${(totalBytes / 1024 / 1024).toFixed(2)} MB, mỗi phần <= ${LIMIT_BYTES / 1024} KB`);
  if (skipped.length) console.log(`   ⚠️  ${skipped.length} file bị bỏ qua (xem 00-manifest.txt)`);
}

main();
