import { execFileSync } from "node:child_process";
import { normalizeUsername } from "../functions/_lib/validation.js";

const username = normalizeUsername(process.env.PORTAL_USERNAME);
const operation = process.env.PORTAL_OPERATION;
if (!username || !["inspect", "set-reader"].includes(operation)) {
  throw new Error("Specify an exact portal username and inspect or set-reader.");
}
function query(sql) {
  return JSON.parse(execFileSync(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "d1", "execute", "rts-royal-db",
    "--remote", "--command", sql, "--json",
  ], { encoding: "utf8" }));
}
const selection = `SELECT username, name, active, portal_access FROM users WHERE username = '${username}'`;
const before = query(selection).flatMap((statement) => statement.results || []);
if (before.length !== 1) throw new Error("Exact portal account not found; no accounts changed.");
console.log(JSON.stringify({ operation, before }));
if (operation === "set-reader") {
  const result = query(
    `UPDATE users SET portal_access='reader', session_version=session_version+1, updated_at=unixepoch()
     WHERE username='${username}'
       AND (portal_access='reader' OR active=0
         OR (SELECT COUNT(*) FROM users WHERE active=1 AND portal_access='admin') > 1)
     RETURNING username, active, portal_access`
  ).flatMap((statement) => statement.results || []);
  if (result.length !== 1 || result[0].portal_access !== "reader") {
    throw new Error("Role change blocked: retain at least one active portal administrator.");
  }
  const after = query(selection).flatMap((statement) => statement.results || []);
  if (after.length !== 1 || after[0].portal_access !== "reader") throw new Error("Role verification failed.");
  console.log(JSON.stringify({ verified: true, after, sessionsInvalidated: true, posAccountsChanged: false }));
}
