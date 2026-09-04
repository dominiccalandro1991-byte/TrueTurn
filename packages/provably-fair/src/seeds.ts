import { fromHex, randomBytes, toHex, utf8 } from "./bytes.ts";
import { sha256 } from "./hash.ts";

export const SEED_BYTES = 32;

export function generateServerSeed(): Uint8Array {
  return randomBytes(SEED_BYTES);
}

export async function parseClientSeed(input: string): Promise<Uint8Array> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Client seed is required");
  if (/^(0x)?[0-9a-f]{64}$/i.test(trimmed)) {
    const bytes = fromHex(trimmed);
    if (bytes.length !== SEED_BYTES) throw new Error("Client seed must be 256 bits");
    return bytes;
  }
  if (trimmed.length > 128) throw new Error("Client seed is too long");
  return sha256(utf8(trimmed));
}

export async function commitServerSeed(serverSeed: Uint8Array): Promise<string> {
  if (serverSeed.length !== SEED_BYTES) throw new Error("Server seed must be 256 bits");
  return toHex(await sha256(serverSeed));
}

export async function verifyCommitment(serverSeed: Uint8Array, commitmentHex: string): Promise<boolean> {
  const actual = await commitServerSeed(serverSeed);
  return actual === commitmentHex.toLowerCase();
}

export function encodeSeed(bytes: Uint8Array): string {
  return toHex(bytes);
}
