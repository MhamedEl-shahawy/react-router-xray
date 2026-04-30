#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..");

const candidates = [
  join(root, "xray"),
  join(root, "xray.exe"),
  join(root, "..", "core", "target", "release", "xray"),
  join(root, "..", "core", "target", "release", "xray.exe")
];

const binary = candidates.find((file) => existsSync(file));
if (!binary) {
  console.error("xray binary not found. Run `pnpm --filter react-router-xray build` first.");
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
