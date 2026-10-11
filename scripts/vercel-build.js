const { spawnSync } = require("node:child_process");

const npmCli = process.env.npm_execpath;
const isProductionDeployment =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

function runNpm(args) {
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: !npmCli && process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (isProductionDeployment) {
  runNpm(["run", "prisma:migrate:deploy"]);
} else {
  console.log("Skipping database migrations outside a Vercel production deployment.");
}

runNpm(["run", "build"]);
