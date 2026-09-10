import { GAME_CATALOG, type GameId } from "../../shared/src/games.ts";
import { ERROR_CODES, PlatformError } from "../../shared/src/errors.ts";
import { createId } from "../../shared/src/ids.ts";
import {
  commitServerSeed,
  encodeSeed,
  generateServerSeed,
  HmacStream,
  parseClientSeed,
  rollDice,
  fisherYates,
} from "../../provably-fair/src/index.ts";
import type { ActionPayload, ApplyContext, GameView, PlayerSeat } from "./engine.ts";
import { environmentFromSeed, type EnvironmentVector } from "./environment.ts";
import { botAction, engines, type AnyState } from "./registry.ts";
import type { EnvironmentLocation } from "../../shared/src/constants.ts";

export interface FairnessPublic {
  commitment: string;
  clientSeed: string;
  nextNonce: number;
  revealedServerSeed: string | null;
  lastRoll?: { nonce: number; dice: number[] };
  lastShuffleNonce?: number;
}

export type TablePhase = "lobby" | "live";

export interface MatchRecord {
  id: string;
  code: string;
  gameId: GameId;
  phase: TablePhase;
  version: number;
  players: PlayerSeat[];
  hostId: string;
  humanId: string;
  seatCount: number;
  state: AnyState | null;
  environment: EnvironmentVector;
  serverSeed: Uint8Array;
  clientSeed: Uint8Array;
  commitment: string;
  nonce: number;
  revealed: boolean;
  lastRoll?: { nonce: number; dice: number[] };
  lastShuffleNonce?: number;
  seenActions: Set<string>;
  createdAt: number;
}

export interface MatchPublic {
  id: string;
  code: string;
  gameId: GameId;
  phase: TablePhase;
  hostId: string;
  seatCount: number;
  version: number;
  view: GameView;
  fairness: FairnessPublic;
  environment: EnvironmentVector;
}

export interface TableListing {
  id: string;
  code: string;
  gameId: GameId;
  phase: TablePhase;
  seated: number;
  seatCount: number;
  hostName: string;
}

export function isOpenSeat(seat: PlayerSeat): boolean {
  return seat.id.startsWith("open_");
}

export function tableCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

function ctxFor(match: MatchRecord): ApplyContext {
  return {
    async drawDice(count: number) {
      match.nonce += 1;
      const stream = new HmacStream(match.serverSeed, match.clientSeed, match.nonce);
      const dice = await rollDice(stream, count);
      match.lastRoll = { nonce: match.nonce, dice };
      return dice;
    },
    async shuffle(items) {
      match.nonce += 1;
      const stream = new HmacStream(match.serverSeed, match.clientSeed, match.nonce);
      match.lastShuffleNonce = match.nonce;
      return fisherYates(items, stream);
    },
    now: Date.now(),
  };
}

function fairnessOf(match: MatchRecord): FairnessPublic {
  return {
    commitment: match.commitment,
    clientSeed: encodeSeed(match.clientSeed),
    nextNonce: match.nonce + 1,
    revealedServerSeed: match.revealed ? encodeSeed(match.serverSeed) : null,
    lastRoll: match.lastRoll,
    lastShuffleNonce: match.lastShuffleNonce,
  };
}

export function projectMatch(match: MatchRecord, playerId: string): MatchPublic {
  const engine = engines[match.gameId];
  const catalog = GAME_CATALOG[match.gameId];
  const claimed = match.players.filter((p) => !isOpenSeat(p));
  const view: GameView =
    match.phase === "live" && match.state
      ? engine.project(match.state, playerId)
      : {
          gameId: match.gameId,
          phase: "lobby",
          toAct: null,
          prompt: `${claimed.length} of ${match.seatCount} seated`,
          scores: {},
          legal:
            playerId === match.hostId && claimed.length >= catalog.seats.min
              ? [{ type: "start", label: "Start table" }]
              : [],
          terminal: false,
          seats: match.players,
          eventLog: [
            `Table ${match.code}`,
            claimed.length >= catalog.seats.min
              ? "Host can start when the family is in."
              : `Need ${catalog.seats.min} real player${catalog.seats.min === 1 ? "" : "s"} to start.`,
          ],
        };
  return {
    id: match.id,
    code: match.code,
    gameId: match.gameId,
    phase: match.phase,
    hostId: match.hostId,
    seatCount: match.seatCount,
    version: match.version,
    view,
    environment: match.environment,
    fairness: fairnessOf(match),
  };
}

export async function createMatchRecord(input: {
  gameId: GameId;
  playerId: string;
  displayName: string;
  clientSeed: string;
  seatCount?: number;
  location?: EnvironmentLocation;
  premium?: boolean;
  fillBots?: boolean;
}): Promise<MatchRecord> {
  const catalog = GAME_CATALOG[input.gameId];
  const seats = Math.min(catalog.seats.max, Math.max(catalog.seats.min, input.seatCount ?? catalog.seats.default));
  const players: PlayerSeat[] = Array.from({ length: seats }, (_, i) => {
    if (i === 0) {
      return { id: input.playerId, name: input.displayName, seat: i, isBot: false };
    }
    if (input.fillBots) {
      return { id: `bot_${i}`, name: `House ${i}`, seat: i, isBot: true };
    }
    return { id: `open_${i}`, name: "Open seat", seat: i, isBot: false };
  });
  const serverSeed = generateServerSeed();
  const clientSeed = await parseClientSeed(input.clientSeed);
  const commitment = await commitServerSeed(serverSeed);
  const engine = engines[input.gameId];
  const live = Boolean(input.fillBots);
  return {
    id: createId("m"),
    code: tableCode(),
    gameId: input.gameId,
    phase: live ? "live" : "lobby",
    version: 1,
    players,
    hostId: input.playerId,
    humanId: input.playerId,
    seatCount: seats,
    state: live ? engine.initialState(players, commitment) : null,
    environment: environmentFromSeed(commitment, input.location, Boolean(input.premium)),
    serverSeed,
    clientSeed,
    commitment,
    nonce: 0,
    revealed: false,
    seenActions: new Set<string>(),
    createdAt: Date.now(),
  };
}

export function joinMatchRecord(
  match: MatchRecord,
  input: { playerId: string; displayName: string },
): MatchRecord {
  const already = match.players.find((p) => p.id === input.playerId);
  if (already) return match;
  if (match.phase !== "lobby") {
    throw new PlatformError(ERROR_CODES.MATCH_CLOSED, "That table already started");
  }
  const open = match.players.find(isOpenSeat);
  if (!open) throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Table is full");
  open.id = input.playerId;
  open.name = input.displayName.slice(0, 24) || "Player";
  open.isBot = false;
  match.version += 1;
  return match;
}

export function startMatchRecord(
  match: MatchRecord,
  playerId: string,
  opts?: { fillBots?: boolean },
): MatchRecord {
  if (match.phase === "live" && match.state) return match;
  if (playerId !== match.hostId) {
    throw new PlatformError(ERROR_CODES.OUT_OF_TURN, "Only the host can start");
  }
  const catalog = GAME_CATALOG[match.gameId];
  if (opts?.fillBots) {
    for (const seat of match.players) {
      if (isOpenSeat(seat)) {
        seat.id = `bot_${seat.seat}`;
        seat.name = `House ${seat.seat}`;
        seat.isBot = true;
      }
    }
  }
  const claimed = match.players.filter((p) => !isOpenSeat(p));
  if (claimed.length < catalog.seats.min) {
    throw new PlatformError(ERROR_CODES.INVALID_INPUT, `Need ${catalog.seats.min} players to start`);
  }
  match.players = claimed.map((p, i) => ({ ...p, seat: i }));
  match.environment = environmentFromSeed(match.commitment, match.environment.location, match.environment.premium, 1);
  match.state = engines[match.gameId].initialState(match.players, match.commitment);
  match.phase = "live";
  match.version += 1;
  return match;
}

export function reclaimOrTakeover(match: MatchRecord, presence: Map<string, number>, now = Date.now()): void {
  if (match.phase !== "live") return;
  for (const p of match.players) {
    if (p.id.startsWith("bot_")) continue;
    const seen = presence.get(p.id) ?? 0;
    const stale = now - seen > 12_000;
    if (stale && !p.isBot) {
      p.isBot = true;
      if (!p.name.endsWith("(away)")) p.name = `${p.name} (away)`;
      match.version += 1;
    } else if (!stale && p.isBot) {
      p.isBot = false;
      p.name = p.name.replace(/ \(away\)$/, "");
      match.version += 1;
    }
  }
}

export function listingOf(match: MatchRecord): TableListing {
  return {
    id: match.id,
    code: match.code,
    gameId: match.gameId,
    phase: match.phase,
    seated: match.players.filter((p) => !isOpenSeat(p)).length,
    seatCount: match.seatCount,
    hostName: match.players.find((p) => p.id === match.hostId)?.name ?? "Host",
  };
}

export async function applyIntent(
  match: MatchRecord,
  input: {
    playerId: string;
    type: string;
    payload?: ActionPayload;
    matchVersion: number;
    idempotencyKey: string;
  },
): Promise<MatchRecord> {
  if (match.seenActions.has(input.idempotencyKey)) return match;
  if (input.matchVersion !== match.version) {
    throw new PlatformError(ERROR_CODES.STALE_VERSION, "Stale match version");
  }
  if (match.phase !== "live" || !match.state) {
    throw new PlatformError(ERROR_CODES.INVALID_INPUT, "Table has not started");
  }
  const engine = engines[match.gameId];
  if (engine.isTerminal(match.state)) {
    throw new PlatformError(ERROR_CODES.MATCH_CLOSED, "Match is complete");
  }
  try {
    match.state = await engine.apply(match.state, input.playerId, input.type, input.payload, ctxFor(match));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Illegal action";
    if (message === "Out of turn") throw new PlatformError(ERROR_CODES.OUT_OF_TURN, message);
    throw new PlatformError(ERROR_CODES.ILLEGAL_ACTION, message);
  }
  match.version += 1;
  match.seenActions.add(input.idempotencyKey);
  if (engine.isTerminal(match.state) && !match.revealed) match.revealed = true;
  const roundFlag = engine.project(match.state, match.humanId).flags?.round;
  if (typeof roundFlag === "number" && roundFlag !== match.environment.round) {
    match.environment = environmentFromSeed(match.commitment, undefined, match.environment.premium, roundFlag);
  }
  return match;
}

export async function applyBotTurn(match: MatchRecord): Promise<MatchRecord> {
  if (match.phase !== "live" || !match.state) return match;
  const engine = engines[match.gameId];
  if (engine.isTerminal(match.state)) return match;
  const view = engine.project(match.state, match.humanId);
  if (!view.toAct) return match;
  const actor = match.players.find((p) => p.id === view.toAct);
  if (!actor?.isBot) return match;
  const intent = botAction(match.state);
  match.state = await engine.apply(match.state, actor.id, intent.type, intent.payload, ctxFor(match));
  match.version += 1;
  if (engine.isTerminal(match.state)) match.revealed = true;
  return match;
}
