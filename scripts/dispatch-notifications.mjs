const secret = process.env.FCM_DISPATCH_SECRET;
if (!secret || secret.length < 48) throw new Error("Missing private notification dispatcher credential.");

const response = await fetch("https://rts-royal.pages.dev/api/pos-mobile-dispatch", {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
  redirect: "error",
  signal: AbortSignal.timeout(120_000),
});
if (!response.ok) throw new Error(`Notification retry failed (HTTP ${response.status}); credential content suppressed.`);
const result = await response.json();
if (result.ok !== true || !Number.isSafeInteger(result.attempted) || !Number.isSafeInteger(result.failed)
    || result.attempted < 0 || result.failed !== 0) {
  throw new Error("Notification dispatcher returned an unexpected result.");
}
console.log(`Notification retry completed: ${result.attempted} alerts attempted.`);
