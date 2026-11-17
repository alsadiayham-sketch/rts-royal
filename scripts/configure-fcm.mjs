import { spawnSync } from "node:child_process";

const value = process.env.RTS_FCM_SERVICE_ACCOUNT;
if (!value) throw new Error("Missing private FCM sender credential.");
let account;
try {
  account = JSON.parse(value);
} catch {
  throw new Error("FCM sender credential is not valid JSON; content suppressed.");
}
if (account.type !== "service_account" || account.project_id !== "rts-business-mobile"
    || account.client_email !== "rts-push-sender@rts-business-mobile.iam.gserviceaccount.com"
    || !account.private_key) {
  throw new Error("Unexpected FCM sender identity.");
}
const dispatchSecret = process.env.FCM_DISPATCH_SECRET;
if (!dispatchSecret || dispatchSecret.length < 48) throw new Error("Missing private FCM dispatcher credential.");
for (const [name, input] of [["FCM_SERVICE_ACCOUNT", value], ["FCM_DISPATCH_SECRET", dispatchSecret]]) {
  const result = spawnSync(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "pages", "secret", "put",
    name, "--project-name", "rts-royal",
  ], { input, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} runtime-secret provisioning failed; content suppressed.`);
}
console.log("Private FCM sender and dispatcher configured; credential content suppressed.");
