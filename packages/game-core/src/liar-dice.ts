import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone } from "./engine.ts";

export interface LiarPlayer extends PlayerSeat {
  cup: number[];
  diceLeft: number;
}

export interface LiarState {
  gameId: "liar-dice";
  players: LiarPlayer[];
  current: number;
  bid: { qty: number; face: number } | null;
  phase: "rolling" | "bidding" | "complete";
  eventLog: string[];
  winnerId?: string;
}

function totalFace(players: LiarPlayer[], face: number): number {
  return players.reduce((n, p) => n + p.cup.filter((d) => d === face).length, 0);
}

export const liarDiceEngine: GameEngine<LiarState> = {
  id: "liar-dice",
  initialState(players) {
    return {
      gameId: "liar-dice",
      players: players.map((p) => ({ ...p, cup: [], diceLeft: 5 })),
      current: 0,
      bid: null,
      phase: "rolling",
      eventLog: ["Liar’s dice. Bid quantity and face. Challenge the last bid."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    const next = clone(state);
    const actor = next.players[next.current];
    if (!actor || actor.id !== playerId) throw new Error("Out of turn");
    if (type === "roll" && next.phase === "rolling") {
      for (const p of next.players) {
        if (p.diceLeft > 0) p.cup = await ctx.drawDice(p.diceLeft);
      }
      next.phase = "bidding";
      next.eventLog = [...next.eventLog.slice(-24), "Cups down."];
      return next;
    }
    if (type === "bid" && next.phase === "bidding") {
      const qty =
        payload && typeof payload === "object" && "qty" in payload ? Number(payload.qty) : Number(payload);
      const face = payload && typeof payload === "object" && "face" in payload ? Number(payload.face) : 6;
      if (qty < 1 || face < 1 || face > 6) throw new Error("Bad bid");
      const prev = next.bid;
      const better = !prev || qty > prev.qty || (qty === prev.qty && face > prev.face);
      if (!better) throw new Error("Bid must rise");
      next.bid = { qty, face };
      next.current = (next.current + 1) % next.players.length;
      while (next.players[next.current]!.diceLeft <= 0) next.current = (next.current + 1) % next.players.length;
      next.eventLog = [...next.eventLog.slice(-24), `${actor.name} bids ${qty}×${face}`];
      return next;
    }
    if (type === "challenge" && next.phase === "bidding" && next.bid) {
      const actual = totalFace(next.players, next.bid.face);
      const bidderIdx = (next.current - 1 + next.players.length) % next.players.length;
      const bidder = next.players[bidderIdx]!;
      const liar = actual < next.bid.qty;
      const loser = liar ? bidder : actor;
      loser.diceLeft -= 1;
      loser.cup = [];
      next.eventLog = [
        ...next.eventLog.slice(-24),
        `Reveal ${actual} ${next.bid.face}s. ${loser.name} loses a die.`,
      ];
      const alive = next.players.filter((p) => p.diceLeft > 0);
      if (alive.length === 1) {
        next.phase = "complete";
        next.winnerId = alive[0]!.id;
        return next;
      }
      next.bid = null;
      next.phase = "rolling";
      next.current = next.players.findIndex((p) => p.id === loser.id);
      if (next.players[next.current]!.diceLeft <= 0) {
        next.current = (next.current + 1) % next.players.length;
      }
      return next;
    }
    throw new Error("Illegal action");
  },
  legalActions(state, playerId) {
    const actor = state.players[state.current];
    if (!actor || actor.id !== playerId || state.phase === "complete") return [];
    if (state.phase === "rolling") return [{ type: "roll", label: "Shake cups" }];
    const acts: LegalAction[] = [];
    const qty = (state.bid?.qty ?? 0) + 1;
    for (const face of [1, 2, 3, 4, 5, 6]) {
      acts.push({
        type: "bid",
        label: `Bid ${qty}×${face}`,
        payload: { qty, face } as ActionPayload,
      });
    }
    if (state.bid) acts.push({ type: "challenge", label: "Liar" });
    return acts;
  },
  isTerminal: (s) => s.phase === "complete",
  scores: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.diceLeft])),
  project(state, playerId) {
    const actor = state.players[state.current];
    const mine = state.players.find((p) => p.id === playerId);
    return {
      gameId: "liar-dice",
      phase: state.phase,
      toAct: actor?.id ?? null,
      prompt: state.bid ? `On the table: ${state.bid.qty}×${state.bid.face}` : "Shake and bid.",
      scores: this.scores(state),
      legal: this.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerId: state.winnerId,
      dice: mine && state.phase !== "rolling" ? mine.cup : [],
      seats: state.players,
      hiddenCounts: Object.fromEntries(state.players.filter((p) => p.id !== playerId).map((p) => [p.id, p.diceLeft])),
      eventLog: state.eventLog,
      flags: { round: state.players.reduce((n, p) => n + (5 - p.diceLeft), 0) },
    } satisfies GameView;
  },
};

export function liarDiceBotAction(state: LiarState): { type: string; payload?: ActionPayload } {
  if (state.phase === "rolling") return { type: "roll" };
  if (state.bid && state.bid.qty >= state.players.reduce((n, p) => n + p.diceLeft, 0)) return { type: "challenge" };
  const qty = (state.bid?.qty ?? 0) + 1;
  return { type: "bid", payload: { qty, face: state.bid?.face ?? 6 } };
}
