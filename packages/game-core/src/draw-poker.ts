import { HOLDEM_BIG_BLIND, HOLDEM_STARTING_STACK } from "../../shared/src/constants.ts";
import type { Card } from "./cards.ts";
import { standardDeck, viewCard } from "./cards.ts";
import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone } from "./engine.ts";
import { compareHands, rankFive } from "./poker.ts";

export interface DrawPlayer extends PlayerSeat {
  stack: number;
  bet: number;
  hand: Card[];
  folded: boolean;
  acted: boolean;
}

export interface DrawState {
  gameId: "five-card-draw";
  players: DrawPlayer[];
  toAct: number;
  street: "deal" | "bet1" | "draw" | "bet2" | "showdown" | "complete";
  pot: number;
  currentBet: number;
  deck: Card[];
  eventLog: string[];
  winnerId?: string;
}

function live(s: DrawState) {
  return s.players.filter((p) => !p.folded);
}

export const drawPokerEngine: GameEngine<DrawState> = {
  id: "five-card-draw",
  initialState(players) {
    return {
      gameId: "five-card-draw",
      players: players.map((p) => ({ ...p, stack: HOLDEM_STARTING_STACK, bet: 0, hand: [], folded: false, acted: false })),
      toAct: 0,
      street: "deal",
      pot: 0,
      currentBet: 0,
      deck: [],
      eventLog: ["Five-card draw. Stand pat or throw."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    const next = clone(state);
    if (next.street === "deal") {
      next.deck = await ctx.shuffle(standardDeck());
      for (const p of next.players) p.hand = next.deck.splice(0, 5);
      next.street = "bet1";
      next.currentBet = HOLDEM_BIG_BLIND;
      const bb = next.players[0]!;
      const put = Math.min(HOLDEM_BIG_BLIND, bb.stack);
      bb.stack -= put;
      bb.bet = put;
      next.pot += put;
      next.toAct = next.players.length > 1 ? 1 : 0;
      next.eventLog = [...next.eventLog, "Hands in."];
      return next;
    }
    const actor = next.players[next.toAct];
    if (!actor || actor.id !== playerId) throw new Error("Out of turn");
    if (type === "fold" && (next.street === "bet1" || next.street === "bet2")) {
      actor.folded = true;
      actor.acted = true;
      next.eventLog = [...next.eventLog.slice(-24), `${actor.name} folds`];
    } else if (type === "call" && (next.street === "bet1" || next.street === "bet2")) {
      const need = next.currentBet - actor.bet;
      const put = Math.min(need, actor.stack);
      actor.stack -= put;
      actor.bet += put;
      next.pot += put;
      actor.acted = true;
    } else if (type === "check" && (next.street === "bet1" || next.street === "bet2") && actor.bet === next.currentBet) {
      actor.acted = true;
    } else if (type === "raise" && (next.street === "bet1" || next.street === "bet2")) {
      const amt = payload && typeof payload === "object" && "amount" in payload ? Number(payload.amount) : HOLDEM_BIG_BLIND * 2;
      const target = next.currentBet + amt;
      const need = target - actor.bet;
      const put = Math.min(need, actor.stack);
      actor.stack -= put;
      actor.bet += put;
      next.pot += put;
      next.currentBet = actor.bet;
      actor.acted = true;
      next.players.forEach((p) => {
        if (!p.folded && p.id !== actor.id) p.acted = false;
      });
    } else if (type === "draw" && next.street === "draw") {
      const ids = Array.isArray(payload) ? payload.map(String) : [];
      if (ids.length > 3) throw new Error("Draw at most three");
      actor.hand = actor.hand.filter((c) => !ids.includes(c.id));
      while (actor.hand.length < 5 && next.deck.length) actor.hand.push(next.deck.shift()!);
      actor.acted = true;
      next.eventLog = [...next.eventLog.slice(-24), `${actor.name} draws ${ids.length}`];
    } else if (type === "stand" && next.street === "draw") {
      actor.acted = true;
    } else {
      throw new Error("Illegal action");
    }

    const waiting = next.players.filter((p) => !p.folded && !p.acted);
    if (waiting.length === 0) {
      if (next.street === "bet1") {
        next.street = "draw";
        next.players.forEach((p) => {
          p.acted = p.folded;
          p.bet = 0;
        });
        next.currentBet = 0;
        next.toAct = next.players.findIndex((p) => !p.folded);
      } else if (next.street === "draw") {
        next.street = "bet2";
        next.players.forEach((p) => {
          p.acted = p.folded;
        });
        next.toAct = next.players.findIndex((p) => !p.folded);
      } else {
        const hands = live(next).map((p) => ({ p, r: rankFive(p.hand) }));
        hands.sort((a, b) => compareHands(b.r, a.r));
        const win = hands[0]!.p;
        win.stack += next.pot;
        next.winnerId = win.id;
        next.street = "complete";
        next.eventLog = [...next.eventLog.slice(-24), `${win.name} takes ${next.pot}`];
      }
    } else {
      next.toAct = next.players.findIndex((p) => p.id === waiting[0]!.id);
    }
    if (live(next).length === 1 && next.street !== "complete") {
      const win = live(next)[0]!;
      win.stack += next.pot;
      next.winnerId = win.id;
      next.street = "complete";
    }
    return next;
  },
  legalActions(state, playerId) {
    if (state.street === "deal") return [{ type: "deal", label: "Deal" }];
    const actor = state.players[state.toAct];
    if (!actor || actor.id !== playerId || state.street === "complete") return [];
    if (state.street === "draw") {
      return [
        { type: "stand", label: "Stand pat" },
        ...actor.hand.map((c) => ({ type: "draw", label: `Throw ${viewCard(c).label}`, payload: [c.id] as ActionPayload })),
      ];
    }
    const acts: LegalAction[] = [{ type: "fold", label: "Fold" }];
    if (actor.bet < state.currentBet) acts.push({ type: "call", label: "Call" });
    else acts.push({ type: "check", label: "Check" });
    acts.push({ type: "raise", label: "Raise", payload: { amount: HOLDEM_BIG_BLIND * 2 } });
    return acts;
  },
  isTerminal: (s) => s.street === "complete",
  scores: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stack])),
  project(state, playerId) {
    const actor = state.players[state.toAct];
    const mine = state.players.find((p) => p.id === playerId);
    return {
      gameId: "five-card-draw",
      phase: state.street,
      toAct: state.street === "deal" ? playerId : (actor?.id ?? null),
      prompt: state.street === "draw" ? "Stand or throw." : "Five-card draw.",
      scores: this.scores(state),
      legal: state.street === "deal" ? [{ type: "deal", label: "Deal" }] : this.legalActions(state, playerId),
      terminal: state.street === "complete",
      winnerId: state.winnerId,
      myHand: mine?.hand.map(viewCard),
      pot: state.pot,
      seats: state.players,
      eventLog: state.eventLog,
    } satisfies GameView;
  },
};

export function drawPokerBotAction(state: DrawState): { type: string; payload?: ActionPayload } {
  if (state.street === "deal") return { type: "deal" };
  if (state.street === "draw") return { type: "stand" };
  const p = state.players[state.toAct]!;
  if (p.bet < state.currentBet) return { type: "call" };
  return { type: "check" };
}
