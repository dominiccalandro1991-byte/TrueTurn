import { createServerFn } from "@tanstack/react-start";
import { GAME_CATALOG, type GameId } from "../../../packages/shared/src/games.ts";
import { ERROR_CODES, PlatformError } from "../../../packages/shared/src/errors.ts";
import { createId } from "../../../packages/shared/src/ids.ts";
import {
  createMatchSchema,
  joinMatchSchema,
  matchActionSchema,
  squadSchema,
  startMatchSchema,
  verifyRequestSchema,
  wardrobeBuySchema,
} from "../../../packages/shared/src/schemas.ts";
import { WARDROBE } from "../../../packages/shared/src/wardrobe.ts";
import { fromHex } from "../../../packages/provably-fair/src/bytes.ts";
import { verifyDice, verifyShuffle } from "../../../packages/provably-fair/src/verify.ts";
import {
  applyBotTurn,
  applyIntent,
  createMatchRecord,
  joinMatchRecord,
  listingOf,
  projectMatch,
  reclaimOrTakeover,
  startMatchRecord,
  tableCode,
} from "../../../packages/game-core/src/match.ts";
import { engines } from "../../../packages/game-core/src/registry.ts";
import { findMatch, findSquad, memory, playersOnline, touchPresence } from "./store.ts";

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
      if (data.squadCode) {
        const squad = findSquad(data.squadCode);
        if (squad) {
          for (const member of squad.members) {
            if (member.id !== data.playerId) {
              try {
                joinMatchRecord(match, { playerId: member.id, displayName: member.name });
              } catch {
                break;
              }
            }
          }
        }
      }
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
      startMatchRecord(match, data.playerId, { fillBots: Boolean(data.fillBots) });
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
    reclaimOrTakeover(match, memory().presence);
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

export const tickBotsFn = createServerFn({ method: "POST" })
  .validator((data: { matchId: string; playerId: string }) => data)
  .handler(async ({ data }) => {
    touchPresence(data.playerId);
    const match = findMatch(data.matchId);
    if (!match) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Match not found");
    reclaimOrTakeover(match, memory().presence);
    await applyBotTurn(match);
    return projectMatch(match, data.playerId);
  });

export const createAvatarJobFn = createServerFn({ method: "POST" })
  .validator((data: { playerId: string; consent: boolean; bytes: number; type: string; seed?: string }) => data)
  .handler(async ({ data }) => {
    if (!data.consent) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Consent is required");
    if (data.bytes <= 0 || data.bytes > 4 * 1024 * 1024) {
      throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Image must be under 4MB");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(data.type)) {
      throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Use JPEG, PNG, or WebP");
    }
    const id = createId("av");
    const meshId = `mesh_${id.slice(-8)}`;
    memory().avatarJobs.set(id, { status: "ready", meshId });
    const existing = memory().avatars.get(data.playerId);
    memory().avatars.set(data.playerId, {
      playerId: data.playerId,
      meshId,
      seed: data.seed ?? meshId,
      wardrobe: existing?.wardrobe ?? [],
      instantiated: true,
    });
    if (!existing?.instantiated) {
      memory().ledger.post({
        userId: data.playerId,
        matchId: null,
        reason: "avatar_instantiate",
        currency: "diamonds",
        amount: 1,
        idempotencyKey: `avatar_grant_${data.playerId}`,
      });
    }
    return { jobId: id, status: "ready" as const, meshId, adapter: "procedural-local" };
  });

export const getAvatarFn = createServerFn({ method: "GET" })
  .validator((data: { playerId: string }) => data)
  .handler(async ({ data }) => memory().avatars.get(data.playerId) ?? null);

export const buyWardrobeFn = createServerFn({ method: "POST" })
  .validator((data) => wardrobeBuySchema.parse(data))
  .handler(async ({ data }) => {
    const item = WARDROBE.find((w) => w.id === data.itemId);
    if (!item) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Unknown item");
    const avatar = memory().avatars.get(data.playerId);
    if (!avatar?.instantiated) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Instantiate an avatar first");
    memory().ledger.post({
      userId: data.playerId,
      matchId: null,
      reason: `wardrobe:${item.id}`,
      currency: item.currency,
      amount: -item.cost,
      idempotencyKey: data.idempotencyKey,
    });
    if (!avatar.wardrobe.includes(item.id)) avatar.wardrobe.push(item.id);
    return { avatar, item };
  });

export const createSquadFn = createServerFn({ method: "POST" })
  .validator((data) => squadSchema.parse(data))
  .handler(async ({ data }) => {
    const code = tableCode();
    const squad = {
      code,
      hostId: data.playerId,
      members: [{ id: data.playerId, name: data.displayName }],
    };
    memory().squads.set(code, squad);
    return squad;
  });

export const joinSquadFn = createServerFn({ method: "POST" })
  .validator((data) => squadSchema.parse(data))
  .handler(async ({ data }) => {
    if (!data.code) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Squad code required");
    const squad = findSquad(data.code);
    if (!squad) throw new PlatformError(ERROR_CODES.NOT_FOUND, "Squad not found");
    if (!squad.members.some((m) => m.id === data.playerId)) {
      if (squad.members.length >= 6) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Squad full");
      squad.members.push({ id: data.playerId, name: data.displayName });
    }
    return squad;
  });

export const listGamesFn = createServerFn({ method: "GET" }).handler(async () => GAME_CATALOG);

export function decodeSeed(hex: string) {
  return fromHex(hex);
}

export { engines };
