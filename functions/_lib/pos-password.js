import { createPasswordRecord, verifyPassword } from "./crypto.js";

export async function createStoredPosPassword(password) {
  const record = await createPasswordRecord(password);
  return {
    passwordSalt: record.salt,
    passwordHash: record.hash,
    passwordIterations: record.iterations,
  };
}

export async function verifyStoredPosPassword(user, password) {
  if (
    typeof user?.passwordSalt === "string" &&
    typeof user?.passwordHash === "string" &&
    Number.isInteger(Number(user.passwordIterations))
  ) {
    return {
      verified: await verifyPassword(password, {
        salt: user.passwordSalt,
        hash: user.passwordHash,
        iterations: Number(user.passwordIterations),
      }),
      migratedUser: null,
    };
  }

  if (typeof user?.password !== "string") {
    return { verified: false, migratedUser: null };
  }

  if (user.password !== password) {
    return { verified: false, migratedUser: null };
  }

  const migratedUser = {
    ...user,
    ...(await createStoredPosPassword(password)),
  };
  delete migratedUser.password;
  return { verified: true, migratedUser };
}
