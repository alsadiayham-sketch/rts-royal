import { execFileSync } from "node:child_process";

const cli = "node_modules/wrangler/bin/wrangler.js";
const args = [cli, "d1", "execute", "rts-royal-db", "--remote"];
const result = JSON.parse(execFileSync(process.execPath, [
  ...args, "--command", "PRAGMA table_info(users)", "--json",
], { encoding: "utf8" }));
if (!result.some((statement) => statement.results?.some((column) => column.name === "portal_access"))) {
  execFileSync(process.execPath, [...args, "--file", "migrations/0006_portal_reader.sql"], { stdio: "inherit" });
}
