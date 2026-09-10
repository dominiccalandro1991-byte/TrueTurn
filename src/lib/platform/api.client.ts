import { GAME_CATALOG } from "../../../packages/shared/src/games.ts";
import { ERROR_CODES, PlatformError } from "../../../packages/shared/src/errors.ts";
import { WARDROBE } from "../../../packages/shared/src/wardrobe.ts";
import { createId } from "../../../packages/shared/src/ids.ts";
import { fromHex } from "../../../packages/provably-fair/src/bytes.ts";
import { verifyDice, verifyShuffle } from "../../../packages/provably-fair/src/verify.ts";
import { engines } from "../../../packages/game-core/src/registry.ts";
import { club, createTable, hostAct, joinTable, newSquad, tables } from "./static-club.ts";

function wrap<T, R>(fn: (data: T) => Promise<R> | R) {
  return (opts?: { data: T }) => Promise.resolve(fn((opts as { data: T }).data));
}

export const bootstrapWallet = wrap(async (data: { playerId: string }) => {
  club.ledger.refreshTokens(data.playerId, Date.now(), `grant_${data.playerId}`);
  const w = club.ledger.wallet(data.playerId);
  club.persist();
  return {
    tokens: w.tokens,
    diamonds: w.diamonds,
    lastTokenGrantAt: w.lastTokenGrantAt,
    history: club.ledger.history(data.playerId),
    playersOnline: Math.max(1, club.rooms.size),
  };
});

export const createMatchFn = wrap(createTable);
export const joinMatchFn = wrap(joinTable);
export const startMatchFn = wrap((data: { matchId: string; playerId: string; fillBots?: boolean }) =>
  hostAct("start", data),
);
export const getMatchFn = wrap((data: { matchId: string; playerId: string }) => hostAct("get", data));
export const actFn = wrap(
  (data: {
    matchId: string;
    playerId: string;
    type: string;
    payload?: unknown;
    matchVersion: number;
    idempotencyKey: string;
  }) => hostAct("act", data),
);
export const tickBotsFn = wrap((data: { matchId: string; playerId: string }) => hostAct("tick", data));
export const listTablesFn = async () => tables();
export const presenceFn = async () => ({ playersOnline: Math.max(1, club.rooms.size), openTables: tables().length });
export const listGamesFn = async () => GAME_CATALOG;

export const verifyFn = wrap(async (data: Parameters<typeof verifyDice>[0] & { kind: string; deckSize?: number; dieCount?: number }) => {
  if (data.kind === "shuffle") {
    const items = Array.from({ length: data.deckSize ?? 52 }, (_, i) => i);
    const result = await verifyShuffle(data.serverSeedHex, data.clientSeedHex, data.nonce, data.commitmentHex, items);
    return { ok: result.ok, message: result.ok ? "Shuffle reproduced." : "Commitment mismatch.", order: result.order };
  }
  return verifyDice({ ...data, count: data.dieCount ?? 1 });
});

export const createAvatarJobFn = wrap(async (data: { playerId: string; consent: boolean; bytes: number; type: string; seed?: string }) => {
  if (!data.consent) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Consent is required");
  const id = createId("av");
  const meshId = `mesh_${id.slice(-8)}`;
  const existing = club.avatars.get(data.playerId);
  club.avatars.set(data.playerId, {
    playerId: data.playerId,
    meshId,
    seed: data.seed ?? meshId,
    wardrobe: existing?.wardrobe ?? [],
    instantiated: true,
  });
  if (!existing?.instantiated) {
    club.ledger.post({
      userId: data.playerId,
      matchId: null,
      reason: "avatar_instantiate",
      currency: "diamonds",
      amount: 1,
      idempotencyKey: `avatar_grant_${data.playerId}`,
    });
  }
  club.persist();
  return { jobId: id, status: "ready" as const, meshId, adapter: "procedural-local" };
});

export const getAvatarFn = wrap(async (data: { playerId: string }) => club.avatars.get(data.playerId) ?? null);

export const buyWardrobeFn = wrap(async (data: { playerId: string; itemId: string; idempotencyKey: string }) => {
  const item = WARDROBE.find((w) => w.id === data.itemId);
  if (!item) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Unknown item");
  const avatar = club.avatars.get(data.playerId);
  if (!avatar?.instantiated) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Instantiate an avatar first");
  club.ledger.post({
    userId: data.playerId,
    matchId: null,
    reason: `wardrobe:${item.id}`,
    currency: item.currency,
    amount: -item.cost,
    idempotencyKey: data.idempotencyKey,
  });
  if (!avatar.wardrobe.includes(item.id)) avatar.wardrobe.push(item.id);
  club.persist();
  return { avatar, item };
});

export const createSquadFn = wrap(async (data: { playerId: string; displayName: string }) => newSquad(data.playerId, data.displayName));
export const joinSquadFn = wrap(async (data: { playerId: string; displayName: string; code?: string }) => {
  if (!data.code) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Squad code required");
  const squad = club.squads.get(data.code.trim().toUpperCase());
  if (!squad) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Squad not found");
  if (!squad.members.some((m) => m.id === data.playerId)) squad.members.push({ id: data.playerId, name: data.displayName });
  return squad;
});

export function decodeSeed(hex: string) {
  return fromHex(hex);
}

export { engines };
