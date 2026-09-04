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

export interface MatchRecord {
  id: string;
  gameId: GameId;
  version: number;
  players: PlayerSeat[];
  humanId: string;
  state: AnyState;
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
  gameId: GameId;
  version: number;
  view: GameView;
  fairness: FairnessPublic;
  environment: EnvironmentVector;
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

export function projectMatch(match: MatchRecord, playerId: string): MatchPublic {
  const engine = engines[match.gameId];
  return {
    id: match.id,
    gameId: match.gameId,
    version: match.version,
    view: engine.project(match.state, playerId),
    environment: match.environment,
    fairness: {
      commitment: match.commitment,
      clientSeed: encodeSeed(match.clientSeed),
      nextNonce: match.nonce + 1,
      revealedServerSeed: match.revealed ? encodeSeed(match.serverSeed) : null,
      lastRoll: match.lastRoll,
      lastShuffleNonce: match.lastShuffleNonce,
    },
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
}): Promise<MatchRecord> {
  const catalog = GAME_CATALOG[input.gameId];
  const seats = Math.min(catalog.seats.max, Math.max(catalog.seats.min, input.seatCount ?? catalog.seats.default));
  const players: PlayerSeat[] = Array.from({ length: seats }, (_, i) => ({
    id: i === 0 ? input.playerId : `bot_${i}`,
    name: i === 0 ? input.displayName : `House ${i}`,
    seat: i,
    isBot: i > 0,
  }));
  const serverSeed = generateServerSeed();
  const clientSeed = await parseClientSeed(input.clientSeed);
  const commitment = await commitServerSeed(serverSeed);
  const engine = engines[input.gameId];
  const state = engine.initialState(players, commitment);
  return {
    id: createId("m"),
    gameId: input.gameId,
    version: 1,
    players,
    humanId: input.playerId,
    state,
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
  return match;
}

export async function applyBotTurn(match: MatchRecord): Promise<MatchRecord> {
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
