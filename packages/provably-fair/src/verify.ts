import { fromHex, toHex } from "./bytes.ts";
import { rollDice } from "./dice.ts";
import { sha256 } from "./hash.ts";
import { fisherYates } from "./shuffle.ts";
import { HmacStream } from "./stream.ts";
import { verifyCommitment } from "./seeds.ts";

export interface VerifyDiceInput {
  serverSeedHex: string;
  clientSeedHex: string;
  nonce: number;
  commitmentHex: string;
  count: number;
}

export interface VerifyDiceResult {
  ok: boolean;
  commitmentMatches: boolean;
  dice: number[];
  message: string;
}

export async function verifyDice(input: VerifyDiceInput): Promise<VerifyDiceResult> {
  const serverSeed = fromHex(input.serverSeedHex);
  const clientSeed = fromHex(input.clientSeedHex);
  const commitmentMatches = await verifyCommitment(serverSeed, input.commitmentHex);
  const stream = new HmacStream(serverSeed, clientSeed, input.nonce);
  const dice = await rollDice(stream, input.count);
  if (!commitmentMatches) {
    return {
      ok: false,
      commitmentMatches,
      dice,
      message: "Commitment does not match the revealed server seed.",
    };
  }
  return {
    ok: true,
    commitmentMatches,
    dice,
    message: "Commitment verified. Dice reproduced from seeds and nonce.",
  };
}

export async function verifyShuffle<T>(
  serverSeedHex: string,
  clientSeedHex: string,
  nonce: number,
  commitmentHex: string,
  items: T[],
): Promise<{ ok: boolean; order: T[]; commitmentMatches: boolean }> {
  const serverSeed = fromHex(serverSeedHex);
  const clientSeed = fromHex(clientSeedHex);
  const commitmentMatches = await verifyCommitment(serverSeed, commitmentHex);
  const stream = new HmacStream(serverSeed, clientSeed, nonce);
  const order = await fisherYates(items, stream);
  return { ok: commitmentMatches, order, commitmentMatches };
}

export async function digestHex(data: Uint8Array): Promise<string> {
  return toHex(await sha256(data));
}
