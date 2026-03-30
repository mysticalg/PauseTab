import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const distDir = path.join(rootDir, "extension", "dist");
const manifestPath = path.join(distDir, "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error("Extension build output not found. Run `npm run build --workspace extension` first.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const outputDir = path.join(rootDir, "artifacts");
const outputPath = path.join(outputDir, `pausetab-extension-v${manifest.version}.zip`);

mkdirSync(outputDir, { recursive: true });
rmSync(outputPath, { force: true });

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Packaging command failed: ${command} ${args.join(" ")}`);
  }
};

if (process.platform === "win32") {
  const distGlob = path.join(distDir, "*");
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${distGlob.replace(/'/g, "''")}' -DestinationPath '${outputPath.replace(/'/g, "''")}' -Force`,
  ]);
} else {
  run("zip", ["-qr", outputPath, "."], { cwd: distDir });
}

console.log(`Packaged extension: ${outputPath}`);
