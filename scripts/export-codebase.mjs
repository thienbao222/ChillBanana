import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "codebase-chunks");
const MAX_CHUNK_BYTES = 80 * 1024; // 80 KB mỗi file để AI không bao giờ bị cắt giữa chừng

const INCLUDE_DIRS = ["src", "prisma", "tests", "scripts", ".github", "docs"];
const ROOT_FILES = [
  "package.json",
  "tsconfig.json",
  "vercel.json",
  "playwright.config.ts",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vitest.config.ts",
  "vitest.integration.config.ts",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.mjs",
  "postcss.config.js",
];

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".prisma", ".json", ".css", ".md", ".yml", ".yaml", ".sql"
]);

const IGNORED_NAMES = new Set([
  "node_modules", ".next", ".git", "coverage", ".vercel",
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "codebase-for-ai.txt", "codebase-chunks", "dev.db", "dev.db-journal"
]);

function shouldProcessFile(fileName) {
  if (IGNORED_NAMES.has(fileName)) return false;
  if (fileName.startsWith(".env") && fileName !== ".env.example") return false;
  if (fileName.startsWith("codebase-part-")) return false;
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

function collectFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, fileList);
    } else if (entry.isFile() && shouldProcessFile(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function generateChunks() {
  // Tạo hoặc làm sạch thư mục đầu ra
  if (fs.existsSync(OUTPUT_DIR)) {
    const oldFiles = fs.readdirSync(OUTPUT_DIR);
    for (const file of oldFiles) {
      if (file.startsWith("codebase-part-") && file.endsWith(".txt")) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    }
  } else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allFiles = [];
  for (const fileName of ROOT_FILES) {
    const fullPath = path.join(ROOT_DIR, fileName);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      allFiles.push(fullPath);
    }
  }
  for (const dir of INCLUDE_DIRS) {
    collectFiles(path.join(ROOT_DIR, dir), allFiles);
  }
  allFiles.sort((a, b) => a.localeCompare(b));

  let partIndex = 1;
  let currentBytes = 0;
  let currentContent = `# ChillBanana Codebase - Part ${partIndex}\n\n`;

  const writtenFiles = [];

  for (const file of allFiles) {
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const block =
      `\n================================================================\n` +
      `FILE: ${relativePath}\n` +
      `================================================================\n\n` +
      `${content}\n`;
    const blockBytes = Buffer.byteLength(block, "utf8");

    if (currentBytes + blockBytes > MAX_CHUNK_BYTES && currentBytes > 0) {
      const outPath = path.join(OUTPUT_DIR, `codebase-part-${partIndex}.txt`);
      fs.writeFileSync(outPath, currentContent, "utf8");
      writtenFiles.push(outPath);
      partIndex++;
      currentBytes = 0;
      currentContent = `# ChillBanana Codebase - Part ${partIndex}\n\n`;
    }

    currentContent += block;
    currentBytes += blockBytes;
  }

  if (currentBytes > 0) {
    const outPath = path.join(OUTPUT_DIR, `codebase-part-${partIndex}.txt`);
    fs.writeFileSync(outPath, currentContent, "utf8");
    writtenFiles.push(outPath);
  }

  console.log(`✅ Đã gom ${allFiles.length} file vào thư mục:`);
  console.log(`   📂 ${OUTPUT_DIR}\\`);
  console.log(`   (Tổng cộng ${writtenFiles.length} phần, mỗi phần ≤ 80 KB)`);
}

generateChunks();
