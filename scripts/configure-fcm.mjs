import { spawnSync } from "node:child_process";

const value = process.env.RTS_FCM_SERVICE_ACCOUNT;
if (!value) throw new Error("Missing private FCM sender credential.");
const account = JSON.parse(value);
if (account.type !== "service_account" || account.project_id !== "rts-business-mobile" || !account.private_key) {
  throw new Error("Unexpected FCM sender identity.");
}
const result = spawnSync(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js", "pages", "secret", "put",
  "FCM_SERVICE_ACCOUNT", "--project-name", "rts-royal",
], { input: value, encoding: "utf8" });
if (result.status !== 0) throw new Error("FCM runtime-secret provisioning failed.");
console.log("Private FCM sender configured; credential content suppressed.");
