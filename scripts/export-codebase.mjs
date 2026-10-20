import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUTPUT_FILE = path.join(ROOT_DIR, "codebase-for-ai.txt");

// Các thư mục và file được duyệt
const INCLUDE_DIRS = ["src", "prisma", "tests", "scripts"];
const ROOT_FILES = [
  "package.json",
  "tsconfig.json",
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

// Các đuôi file cho phép
const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".prisma",
  ".json",
  ".css",
  ".md",
]);

// Danh sách file / thư mục bỏ qua tuyệt đối
const IGNORED_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  ".vercel",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "codebase-for-ai.txt",
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.production",
  "dev.db",
  "dev.db-journal",
]);

function shouldProcessFile(filePath, fileName) {
  if (IGNORED_NAMES.has(fileName)) return false;
  if (fileName.startsWith(".env")) return false;
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

function collectFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (IGNORED_NAMES.has(entry.name)) continue;

    if (entry.isDirectory()) {
      collectFiles(fullPath, fileList);
    } else if (entry.isFile() && shouldProcessFile(fullPath, entry.name)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

function generateBundle() {
  const allFiles = [];

  // Gom root files
  for (const fileName of ROOT_FILES) {
    const fullPath = path.join(ROOT_DIR, fileName);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      allFiles.push(fullPath);
    }
  }

  // Gom theo thư mục
  for (const dir of INCLUDE_DIRS) {
    const fullPath = path.join(ROOT_DIR, dir);
    collectFiles(fullPath, allFiles);
  }

  // Sắp xếp theo thứ tự bảng chữ cái để AI dễ theo dõi
  allFiles.sort((a, b) => a.localeCompare(b));

  const outputStream = fs.createWriteStream(OUTPUT_FILE, { encoding: "utf8" });

  outputStream.write("# ChillBanana Codebase Bundle for AI\n");
  outputStream.write(`# Generated at: ${new Date().toISOString()}\n`);
  outputStream.write(`# Total source files: ${allFiles.length}\n\n`);

  outputStream.write("## DIRECTORY STRUCTURE\n```\n");
  for (const file of allFiles) {
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
    outputStream.write(`${relativePath}\n`);
  }
  outputStream.write("```\n\n");

  outputStream.write("## SOURCE CODE FILES\n\n");

  let totalBytes = 0;
  for (const file of allFiles) {
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    totalBytes += Buffer.byteLength(content, "utf8");

    outputStream.write(`\n================================================================\n`);
    outputStream.write(`FILE: ${relativePath}\n`);
    outputStream.write(`================================================================\n\n`);
    outputStream.write(content);
    outputStream.write("\n");
  }

  outputStream.end(() => {
    const sizeMb = (totalBytes / (1024 * 1024)).toFixed(2);
    console.log(`\n Đã xuất toàn bộ mã nguồn thành công vào:`);
    console.log(`   -> ${OUTPUT_FILE}`);
    console.log(`   -> Tổng số file: ${allFiles.length}`);
    console.log(`   -> Dung lượng: ~${sizeMb} MB (văn bản thuần túy, không nén, AI đọc được 100%)\n`);
  });
}

generateBundle();
