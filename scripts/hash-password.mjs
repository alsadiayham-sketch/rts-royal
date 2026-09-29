import { readFileSync } from "node:fs";
import { createPasswordRecord } from "../functions/_lib/crypto.js";

if (process.stdin.isTTY || process.argv.length > 2) {
  console.error("Supply the password through standard input, not command-line arguments.");
  process.exit(1);
}

const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");

if (password.length < 12 || password.length > 128) {
  console.error("Password must be 12-128 characters for new/updated accounts.");
  process.exit(1);
}

const record = await createPasswordRecord(password, 100000);
process.stdout.write(
  `${JSON.stringify(
    {
      password_salt: record.salt,
      password_hash: record.hash,
      password_iterations: record.iterations,
    },
    null,
    2
  )}\n`
);
