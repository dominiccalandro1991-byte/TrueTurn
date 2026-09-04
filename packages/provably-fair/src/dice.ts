import { HmacStream } from "./stream.ts";

/**
 * Bias-resistant d6.
 *
 * Spec original: Outcome = (H mod 6) + 1. Direct modulo of a 256-bit digest is
 * slightly biased because 2^256 is not divisible by 6. This implementation uses
 * rejection sampling on bytes: accept 0..251 (42*6 values), reject 252..255.
 *
 * The naive modulo formula is preserved as `dieNaiveMod6` for documentation
 * comparison only and is never used for live outcomes.
 */
export async function rollDie(stream: HmacStream): Promise<number> {
  while (true) {
    const byte = await stream.nextByte();
    if (byte < 252) return (byte % 6) + 1;
  }
}

export async function rollDice(stream: HmacStream, count: number): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(await rollDie(stream));
  return out;
}

export function dieNaiveMod6(digest: Uint8Array): number {
  const last = digest[digest.length - 1] ?? 0;
  return (last % 6) + 1;
}
