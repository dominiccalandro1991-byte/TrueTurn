import { createServerFn } from "@tanstack/react-start";
import { GAME_CATALOG, type GameId } from "../../../packages/shared/src/games.ts";
import { ERROR_CODES, PlatformError } from "../../../packages/shared/src/errors.ts";
import { createId } from "../../../packages/shared/src/ids.ts";
import {
  createMatchSchema,
  joinMatchSchema,
  matchActionSchema,
  startMatchSchema,
  verifyRequestSchema,
} from "../../../packages/shared/src/schemas.ts";
import { fromHex } from "../../../packages/provably-fair/src/bytes.ts";
import { verifyDice, verifyShuffle } from "../../../packages/provably-fair/src/verify.ts";
import {
  applyIntent,
  createMatchRecord,
  joinMatchRecord,
  listingOf,
  projectMatch,
  startMatchRecord,
} from "../../../packages/game-core/src/match.ts";
import { engines } from "../../../packages/game-core/src/registry.ts";
import { findMatch, memory, playersOnline, touchPresence } from "./store.ts";

function publicError(error: unknown): never {
  if (error instanceof PlatformError) {
    throw error;
  }
  throw new PlatformError(ERROR_CODES.INVALID_INPUT, error instanceof Error ? error.message : "Request failed");
}

export const bootstrapWallet = createServerFn({ method: "POST" })
  .validator((data: { playerId: string }) => data)
  .handler(async ({ data }) => {
    touchPresence(data.playerId);
    const ledger = memory().ledger;
    ledger.refreshTokens(data.playerId, Date.now(), `grant_${data.playerId}`);
    const w = ledger.wallet(data.playerId);
    return {
      tokens: w.tokens,
      diamonds: w.diamonds,
      lastTokenGrantAt: w.lastTokenGrantAt,
      history: ledger.history(data.playerId),
      playersOnline: playersOnline(),
    };
  });

export const createMatchFn = createServerFn({ method: "POST" })
  .validator((data) => createMatchSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      touchPresence(data.playerId);
      const mem = memory();
      const catalog = GAME_CATALOG[data.gameId as GameId];
      const premium = mem.ledger.wallet(data.playerId).diamonds > 0;
      const match = await createMatchRecord({
        gameId: data.gameId,
        playerId: data.playerId,
        displayName: data.displayName,
        clientSeed: data.clientSeed,
        seatCount: data.seatCount,
        location: data.environmentLocation,
        premium,
        fillBots: false,
      });
      if (catalog.anteTokens > 0) {
        mem.ledger.post({
          userId: data.playerId,
          matchId: match.id,
          reason: `ante:${data.gameId}`,
          currency: "tokens",
          amount: -catalog.anteTokens,
          idempotencyKey: data.idempotencyKey,
        });
      }
      mem.matches.set(match.id, match);
      return projectMatch(match, data.playerId);
    } catch (error) {
      publicError(error);
    }
  });

export const joinMatchFn = createServerFn({ method: "POST" })
  .validator((data) => joinMatchSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      touchPresence(data.playerId);
      const match = findMatch(data.table);
      if (!match) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Table not found");
      joinMatchRecord(match, { playerId: data.playerId, displayName: data.displayName });
      return projectMatch(match, data.playerId);
    } catch (error) {
      publicError(error);
    }
  });

export const startMatchFn = createServerFn({ method: "POST" })
  .validator((data) => startMatchSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      touchPresence(data.playerId);
      const match = findMatch(data.matchId);
      if (!match) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Table not found");
      startMatchRecord(match, data.playerId);
      return projectMatch(match, data.playerId);
    } catch (error) {
      publicError(error);
    }
  });

export const listTablesFn = createServerFn({ method: "GET" }).handler(async () => {
  return [...memory().matches.values()]
    .filter((m) => m.phase === "lobby" || m.phase === "live")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 24)
    .map(listingOf);
});

export const presenceFn = createServerFn({ method: "GET" }).handler(async () => ({
  playersOnline: playersOnline(),
  openTables: [...memory().matches.values()].filter((m) => m.phase === "lobby").length,
}));

export const getMatchFn = createServerFn({ method: "GET" })
  .validator((data: { matchId: string; playerId: string }) => data)
  .handler(async ({ data }) => {
    touchPresence(data.playerId);
    const match = findMatch(data.matchId);
    if (!match) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Match not found");
    return projectMatch(match, data.playerId);
  });

export const actFn = createServerFn({ method: "POST" })
  .validator((data) => matchActionSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      touchPresence(data.playerId);
      const match = findMatch(data.matchId);
      if (!match) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Match not found");
      await applyIntent(match, {
        playerId: data.playerId,
        type: data.type,
        payload: data.payload,
        matchVersion: data.matchVersion,
        idempotencyKey: data.idempotencyKey,
      });
      return projectMatch(match, data.playerId);
    } catch (error) {
      publicError(error);
    }
  });

export const verifyFn = createServerFn({ method: "POST" })
  .validator((data) => verifyRequestSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.kind === "shuffle") {
      const items = Array.from({ length: data.deckSize ?? 52 }, (_, i) => i);
      const result = await verifyShuffle(data.serverSeedHex, data.clientSeedHex, data.nonce, data.commitmentHex, items);
      return { ok: result.ok, message: result.ok ? "Shuffle reproduced." : "Commitment mismatch.", order: result.order };
    }
    return verifyDice({
      serverSeedHex: data.serverSeedHex,
      clientSeedHex: data.clientSeedHex,
      nonce: data.nonce,
      commitmentHex: data.commitmentHex,
      count: data.dieCount ?? 1,
    });
  });

export const createAvatarJobFn = createServerFn({ method: "POST" })
  .validator((data: { playerId: string; consent: boolean; bytes: number; type: string }) => data)
  .handler(async ({ data }) => {
    if (!data.consent) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Consent is required");
    if (data.bytes <= 0 || data.bytes > 4 * 1024 * 1024) {
      throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Image must be under 4MB");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(data.type)) {
      throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Use JPEG, PNG, or WebP");
    }
    const id = createId("av");
    memory().avatarJobs.set(id, { status: "queued", meshId: null });
    memory().avatarJobs.set(id, { status: "ready", meshId: `mesh_${id.slice(-8)}` });
    return { jobId: id, status: "ready" as const, meshId: `mesh_${id.slice(-8)}`, adapter: "mock-local" };
  });

export const listGamesFn = createServerFn({ method: "GET" }).handler(async () => GAME_CATALOG);

export function decodeSeed(hex: string) {
  return fromHex(hex);
}

export { engines };
