import { GAME_CATALOG, type GameId } from "../../../packages/shared/src/games.ts";
import { ERROR_CODES, PlatformError } from "../../../packages/shared/src/errors.ts";
import { WARDROBE } from "../../../packages/shared/src/wardrobe.ts";
import { createId } from "../../../packages/shared/src/ids.ts";
import { Ledger } from "../../../packages/game-core/src/ledger.ts";
import {
  applyBotTurn,
  applyIntent,
  createMatchRecord,
  joinMatchRecord,
  listingOf,
  projectMatch,
  startMatchRecord,
  tableCode,
  type MatchPublic,
  type MatchRecord,
  type TableListing,
} from "../../../packages/game-core/src/match.ts";
import type { AvatarRecord, SquadRecord } from "./store.ts";

type Room = {
  makeAction: (name: string) => [(payload: unknown, peer?: string) => void, (fn: (payload: unknown, peer: string) => void) => void];
  getPeers: () => Record<string, unknown>;
  leave?: () => void;
};

const HOST_KEY = "trueturn.host.";
const LEDGER_KEY = "trueturn.ledger.v1";
const AVATAR_KEY = "trueturn.avatars.v1";

class StaticClub {
  matches = new Map<string, MatchRecord>();
  views = new Map<string, MatchPublic>();
  ledger = new Ledger();
  avatars = new Map<string, AvatarRecord>();
  squads = new Map<string, SquadRecord>();
  rooms = new Map<string, Room>();
  peerPlayer = new Map<string, { playerId: string; displayName: string }>();
  pending = new Map<string, (view: MatchPublic) => void>();

  constructor() {
    this.hydrate();
  }

  hydrate() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { wallets: [string, { userId: string; tokens: number; diamonds: number; lastTokenGrantAt: number }][] };
        for (const [id, w] of parsed.wallets ?? []) this.ledger.wallets.set(id, w);
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(AVATAR_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AvatarRecord[];
        for (const a of parsed) this.avatars.set(a.playerId, a);
      }
    } catch {
      /* ignore */
    }
  }

  persist() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify({ wallets: [...this.ledger.wallets.entries()] }),
    );
    localStorage.setItem(AVATAR_KEY, JSON.stringify([...this.avatars.values()]));
  }

  isHost(code: string): boolean {
    return typeof localStorage !== "undefined" && localStorage.getItem(HOST_KEY + code) === "1";
  }

  markHost(code: string) {
    localStorage.setItem(HOST_KEY + code, "1");
  }

  find(idOrCode: string): MatchRecord | undefined {
    const direct = this.matches.get(idOrCode);
    if (direct) return direct;
    const code = idOrCode.trim().toUpperCase();
    for (const m of this.matches.values()) if (m.code === code || m.id === idOrCode) return m;
    return undefined;
  }

  async room(code: string): Promise<Room> {
    const existing = this.rooms.get(code);
    if (existing) return existing;
    try {
      const mod = (await import("@trystero-p2p/torrent")) as { joinRoom: (cfg: { appId: string }, room: string) => Room };
      const room = mod.joinRoom({ appId: "trueturn" }, code);
      const [send, listen] = room.makeAction("tt");
      listen((payload, peer) => this.onMessage(code, payload, peer, send));
      (room as Room & { send: typeof send }).send = send;
      this.rooms.set(code, room);
      return room;
    } catch {
      const stub: Room & { send: (p: unknown, peer?: string) => void } = {
        makeAction: () => [() => {}, () => {}],
        getPeers: () => ({}),
        send: () => {},
      };
      this.rooms.set(code, stub);
      return stub;
    }
  }

  onMessage(code: string, payload: unknown, peer: string, send: (p: unknown, peer?: string) => void) {
    const msg = payload as { t: string; playerId?: string; displayName?: string; view?: MatchPublic; intent?: Record<string, unknown> };
    if (msg.t === "join" && this.isHost(code) && msg.playerId && msg.displayName) {
      const match = this.find(code);
      if (!match) return;
      this.peerPlayer.set(peer, { playerId: msg.playerId, displayName: msg.displayName });
      try {
        joinMatchRecord(match, { playerId: msg.playerId, displayName: msg.displayName });
      } catch {
        /* already seated or full */
      }
      send({ t: "view", view: projectMatch(match, msg.playerId) }, peer);
      return;
    }
    if (msg.t === "view" && msg.view) {
      this.views.set(msg.view.code, msg.view);
      this.views.set(msg.view.id, msg.view);
      this.pending.get(msg.view.code)?.(msg.view);
      this.pending.get(msg.view.id)?.(msg.view);
      return;
    }
    if (msg.t === "intent" && this.isHost(code) && msg.intent) {
      const match = this.find(code);
      if (!match) return;
      const intent = msg.intent as {
        playerId: string;
        type: string;
        payload?: never;
        matchVersion: number;
        idempotencyKey: string;
      };
      void (async () => {
        if (intent.type === "start") startMatchRecord(match, intent.playerId, { fillBots: Boolean((msg.intent as { fillBots?: boolean }).fillBots) });
        else if (intent.type === "tick") await applyBotTurn(match);
        else await applyIntent(match, intent);
        const who = this.peerPlayer.get(peer);
        send({ t: "view", view: projectMatch(match, who?.playerId ?? intent.playerId) }, peer);
      })();
    }
  }

  async waitView(code: string, ms = 8000): Promise<MatchPublic> {
    const cached = this.views.get(code);
    if (cached) return cached;
    return new Promise((resolve, reject) => {
      const t = window.setTimeout(() => reject(new PlatformError(ERROR_CODES.NOT_FOUND, "Table not found")), ms);
      this.pending.set(code, (view) => {
        window.clearTimeout(t);
        resolve(view);
      });
    });
  }

  pushLocal(match: MatchRecord, playerId: string): MatchPublic {
    this.matches.set(match.id, match);
    this.matches.set(match.code, match);
    const view = projectMatch(match, playerId);
    this.views.set(match.id, view);
    this.views.set(match.code, view);
    return view;
  }
}

export const club = new StaticClub();

export async function createTable(data: {
  gameId: GameId;
  playerId: string;
  displayName: string;
  clientSeed: string;
  seatCount?: number;
  environmentLocation?: string;
  fillBots?: boolean;
  squadCode?: string;
  idempotencyKey: string;
}): Promise<MatchPublic> {
  const match = await createMatchRecord({
    gameId: data.gameId,
    playerId: data.playerId,
    displayName: data.displayName,
    clientSeed: data.clientSeed,
    seatCount: data.seatCount,
    fillBots: false,
  });
  if (GAME_CATALOG[data.gameId].anteTokens > 0) {
    club.ledger.post({
      userId: data.playerId,
      matchId: match.id,
      reason: `ante:${data.gameId}`,
      currency: "tokens",
      amount: -GAME_CATALOG[data.gameId].anteTokens,
      idempotencyKey: data.idempotencyKey,
    });
    club.persist();
  }
  club.markHost(match.code);
  const view = club.pushLocal(match, data.playerId);
  void club.room(match.code).catch(() => undefined);
  return view;
}

export async function joinTable(data: { table: string; playerId: string; displayName: string }): Promise<MatchPublic> {
  const code = data.table.trim().toUpperCase();
  const local = club.find(code);
  if (local) {
    joinMatchRecord(local, data);
    return club.pushLocal(local, data.playerId);
  }
  const room = await club.room(code);
  const send = (room as Room & { send: (p: unknown, peer?: string) => void }).send;
  send({ t: "join", playerId: data.playerId, displayName: data.displayName });
  return club.waitView(code);
}

export async function hostAct(
  kind: "start" | "act" | "tick" | "get",
  data: {
    matchId: string;
    playerId: string;
    displayName?: string;
    fillBots?: boolean;
    type?: string;
    payload?: unknown;
    matchVersion?: number;
    idempotencyKey?: string;
  },
): Promise<MatchPublic> {
  const code = data.matchId.trim().toUpperCase();
  const local = club.find(code) ?? club.find(data.matchId);
  if (local && club.isHost(local.code)) {
    if (kind === "start") startMatchRecord(local, data.playerId, { fillBots: Boolean(data.fillBots) });
    else if (kind === "tick") await applyBotTurn(local);
    else if (kind === "act") {
      await applyIntent(local, {
        playerId: data.playerId,
        type: data.type ?? "roll",
        payload: data.payload as never,
        matchVersion: data.matchVersion ?? local.version,
        idempotencyKey: data.idempotencyKey ?? createId("act"),
      });
    }
    return club.pushLocal(local, data.playerId);
  }
  if (kind === "get") {
    const cached = club.views.get(code) ?? club.views.get(data.matchId);
    if (cached) return cached;
    await club.room(code);
    const room = club.rooms.get(code)!;
    const send = (room as Room & { send: (p: unknown) => void }).send;
    send({ t: "join", playerId: data.playerId, displayName: data.displayName ?? "Player" });
    return club.waitView(code);
  }
  const room = await club.room(code);
  const send = (room as Room & { send: (p: unknown) => void }).send;
  send({
    t: "intent",
    intent: {
      playerId: data.playerId,
      type: kind === "start" ? "start" : kind === "tick" ? "tick" : data.type,
      payload: data.payload,
      matchVersion: data.matchVersion,
      idempotencyKey: data.idempotencyKey,
      fillBots: data.fillBots,
    },
  });
  return club.waitView(code);
}

export function tables(): TableListing[] {
  return [...club.matches.values()]
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .map(listingOf);
}

export function newSquad(playerId: string, displayName: string): SquadRecord {
  const code = tableCode();
  const squad = { code, hostId: playerId, members: [{ id: playerId, name: displayName }] };
  club.squads.set(code, squad);
  return squad;
}

export { tableCode };
