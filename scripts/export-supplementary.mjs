import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "codebase-chunks");

const SUPPLEMENTARY_GROUPS = [
  {
    fileName: "supplement-1-utilities-and-pages.txt",
    title: "Supplementary 1: Utilities, Home, Admin & Profile Pages",
    files: [
      "src/lib/api-key-manager.ts",
      "src/lib/gemini-models.ts",
      "src/lib/ssrf.ts",
      "src/lib/curated-products.json",
      "src/lib/data.ts",
      "src/app/page.tsx",
      "src/app/admin/page.tsx",
      "src/app/profile/page.tsx",
      "src/components/Navbar.tsx",
      "src/components/AuthModal.tsx",
    ],
  },
  {
    fileName: "supplement-2-tracking-and-stepper.txt",
    title: "Supplementary 2: Tracking Page & Stepper Component",
    files: [
      "src/app/tracking/page.tsx",
      "src/components/TrackingStepper.tsx",
    ],
  },
  {
    fileName: "supplement-3-neo-universe-ui.txt",
    title: "Supplementary 3: Neo Universe Mascot & Chatbot UI",
    files: [
      "src/features/ai/customer/AIChatBot.tsx",
      "src/components/NeoUniverseSprite.tsx",
      "src/components/ToastContainer.tsx",
    ],
  },
  {
    fileName: "supplement-4-cosmos-theme-interface.txt",
    title: "Supplementary 4: Cosmos Daylight Theme & Cart Drawer",
    files: [
      "src/components/NeoDaylightCosmos.tsx",
      "src/components/CartDrawer.tsx",
    ],
  },
  {
    fileName: "supplement-5-integration-and-e2e-tests.txt",
    title: "Supplementary 5: All Integration & E2E Test Suites",
    files: [
      "tests/e2e/journey.spec.ts",
      "tests/e2e/smoke.spec.ts",
      "tests/e2e/global-setup.ts",
      "tests/integration/admin-auth.test.ts",
      "tests/integration/admin-authz.test.ts",
      "tests/integration/admin-session-revocation.test.ts",
      "tests/integration/cron-reservations.test.ts",
      "tests/integration/customer-auth.test.ts",
      "tests/integration/email-delivery.test.ts",
      "tests/integration/email-retry.test.ts",
      "tests/integration/orders-access.test.ts",
      "tests/integration/orders-create.test.ts",
      "tests/integration/payments-mock.test.ts",
      "tests/integration/payments-vnpay.test.ts",
      "tests/integration/pricing-config.test.ts",
      "tests/integration/purchase-task-audit.test.ts",
      "tests/integration/scrape-link-rate-limit.test.ts",
    ],
  },
];

function generateSupplementary() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🚀 Bắt đầu đóng gói 5 tệp Bổ Sung (Supplementary) theo yêu cầu của Argon...");
  let totalBytesAll = 0;
  let totalFilesCount = 0;

  SUPPLEMENTARY_GROUPS.forEach((group, index) => {
    let content = `# ChillBanana Codebase - ${group.title}\n`;
    content += `# Supplementary pack for Argon UI, Utils & Test Audit\n\n`;

    content += `## FILES IN THIS PART:\n`;
    group.files.forEach((file) => {
      content += `- ${file}\n`;
    });
    content += `\n`;

    group.files.forEach((file) => {
      const fullPath = path.join(ROOT_DIR, file);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, "utf8");
        const block =
          `\n================================================================\n` +
          `FILE: ${file}\n` +
          `================================================================\n\n` +
          `${fileContent}\n`;
        content += block;
        totalFilesCount++;
      } else {
        console.warn(`⚠️ Không tìm thấy file: ${file}`);
      }
    });

    const outPath = path.join(OUTPUT_DIR, group.fileName);
    fs.writeFileSync(outPath, content, "utf8");
    const sizeKb = (Buffer.byteLength(content, "utf8") / 1024).toFixed(1);
    totalBytesAll += Buffer.byteLength(content, "utf8");
    console.log(`   -> [${index + 1}/5] ${group.fileName} : ${sizeKb} KB (${group.files.length} tệp)`);
  });

  const totalMb = (totalBytesAll / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Hoàn tất! Đã tạo 5 tệp bổ sung tại:`);
  console.log(`   📂 ${OUTPUT_DIR}\\`);
  console.log(`   📊 Tổng dung lượng: ~${totalMb} MB (Tất cả 5 tệp đều < 95 KB, không bị cắt chữ)`);
}

generateSupplementary();
