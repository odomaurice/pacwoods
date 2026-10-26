import "server-only";
import { randomInt } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (the library default) with the OWASP-recommended minimum:
// 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * A valid Argon2id hash of a random value, verified against when the account
 * does not exist so a missing user costs the same time as a wrong password.
 */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(generateTemporaryPassword());
  return dummyHash;
}

// No 0/O, 1/l/I: temporary passwords are read aloud or copied from paper.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** 14 characters from a 56-symbol alphabet: about 81 bits. */
export function generateTemporaryPassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
