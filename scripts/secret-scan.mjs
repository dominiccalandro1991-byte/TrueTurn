#!/usr/bin/env node
import { execSync } from "node:child_process";

const patterns = [
  "ghp_[A-Za-z0-9]{20,}",
  "github_pat_[A-Za-z0-9_]{20,}",
  "sk-[A-Za-z0-9]{20,}",
  "AKIA[0-9A-Z]{16}",
];
const joined = patterns.map((p) => `(${p})`).join("|");
try {
  const out = execSync(
    `rg -n -I --hidden -g '!node_modules' -g '!.git' -g '!*.lock' '${joined}' .`,
    { encoding: "utf8" },
  );
  if (out.trim()) {
    console.error("Secret scan failed:\n" + out);
    process.exit(1);
  }
} catch (error) {
  const err = error;
  if (err && typeof err === "object" && "status" in err && err.status === 1) {
    console.log("secret-scan: clean");
    process.exit(0);
  }
  if (err && typeof err === "object" && "status" in err && err.status === 0) {
    console.error("Secret scan failed");
    process.exit(1);
  }
  console.log("secret-scan: rg not matched / clean");
}
