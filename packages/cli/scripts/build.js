#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const cliRoot = join(here, "..");
const workspaceRoot = join(cliRoot, "..", "..");
const coreManifest = join(workspaceRoot, "packages", "core", "Cargo.toml");
const exeExt = process.platform === "win32" ? ".exe" : "";
const builtBinary = join(workspaceRoot, "target", "release", `xray${exeExt}`);
const outputBinary = join(cliRoot, `xray${exeExt}`);

const build = spawnSync(
  "cargo",
  ["build", "--release", "--bin", "xray", "--manifest-path", coreManifest, "--features", "cli"],
  { stdio: "inherit" }
);

if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(builtBinary)) {
  console.error(`Built binary not found at ${builtBinary}`);
  process.exit(1);
}

copyFileSync(builtBinary, outputBinary);
console.log(`Copied ${builtBinary} -> ${outputBinary}`);
