import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isWatch = process.argv.includes("--watch");
const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicDir = path.join(repoRoot, "public");
const distDir = path.join(repoRoot, "dist");
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

async function copyAssets() {
  console.log("Copying public assets to dist...");
  await fs.cp(publicDir, distDir, { recursive: true });
  console.log("Assets copied successfully.");
}

async function runTsc(watchMode) {
  const args = [tscBin];
  if (watchMode) {
    args.push("--watch", "--preserveWatchOutput");
  }

  console.log(`Running TypeScript compiler (${watchMode ? "watch mode" : "one-shot"})...`);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

async function startWatch() {
  await copyAssets();

  console.log("Watching public directory for changes...");
  let copyTimeout = null;
  const watcher = watch(publicDir, { recursive: true }, () => {
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(async () => {
      try {
        console.log("Change detected in public directory. Re-copying assets...");
        await fs.cp(publicDir, distDir, { recursive: true });
        console.log("Assets updated.");
      } catch (err) {
        console.error("Failed to re-copy public assets:", err);
      }
    }, 100);
  });

  const cleanup = () => {
    watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  await runTsc(true);
}

async function build() {
  console.log("Cleaning dist directory...");
  await fs.rm(distDir, { recursive: true, force: true });

  await copyAssets();

  const exitCode = await runTsc(false);
  console.log(`TypeScript compilation finished with exit code ${exitCode}.`);
  process.exit(exitCode);
}

if (isWatch) {
  startWatch().catch((err) => {
    console.error("Watch mode failed:", err);
    process.exit(1);
  });
} else {
  build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
}
