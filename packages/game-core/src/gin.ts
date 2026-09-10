import type { Card } from "./cards.ts";
import { pokerValue, standardDeck, viewCard } from "./cards.ts";
import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone } from "./engine.ts";

export interface GinPlayer extends PlayerSeat {
  hand: Card[];
  score: number;
}

export interface GinState {
  gameId: "gin-rummy";
  players: GinPlayer[];
  current: number;
  stock: Card[];
  discard: Card[];
  phase: "draw" | "discard" | "complete";
  drawn: boolean;
  eventLog: string[];
  winnerId?: string;
}

function bySuit(hand: Card[]): Record<string, Card[]> {
  const m: Record<string, Card[]> = {};
  for (const c of hand) (m[c.suit] ??= []).push(c);
  for (const k of Object.keys(m)) m[k]!.sort((a, b) => pokerValue(a.rank) - pokerValue(b.rank));
  return m;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const walk = (s: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = s; i < items.length; i++) {
      acc.push(items[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  if (!cards.every((c) => c.suit === cards[0]!.suit)) return false;
  const v = cards.map((c) => pokerValue(c.rank)).sort((a, b) => a - b);
  for (let i = 1; i < v.length; i++) if (v[i] !== v[i - 1]! + 1) return false;
  return true;
}

function isSet(cards: Card[]): boolean {
  return cards.length >= 3 && cards.every((c) => c.rank === cards[0]!.rank);
}

export function deadwood(hand: Card[]): number {
  const ids = hand.map((c) => c.id);
  let best = 99;
  const groups: Card[][] = [];
  const ranks: Record<string, Card[]> = {};
  for (const c of hand) (ranks[c.rank] ??= []).push(c);
  for (const g of Object.values(ranks)) if (g.length >= 3) groups.push(g);
  for (const suitCards of Object.values(bySuit(hand))) {
    for (let len = 3; len <= suitCards.length; len++) {
      for (let i = 0; i <= suitCards.length - len; i++) {
        const slice = suitCards.slice(i, i + len);
        if (isRun(slice)) groups.push(slice);
      }
    }
  }
  const tryCover = (used: Set<string>, idx: number) => {
    const leftover = hand.filter((c) => !used.has(c.id));
    const pts = leftover.reduce((n, c) => n + Math.min(10, pokerValue(c.rank) === 14 ? 1 : Math.min(10, pokerValue(c.rank))), 0);
    best = Math.min(best, pts);
    for (let i = idx; i < groups.length; i++) {
      const g = groups[i]!;
      if (g.some((c) => used.has(c.id))) continue;
      const next = new Set(used);
      g.forEach((c) => next.add(c.id));
      tryCover(next, i + 1);
    }
    void ids;
    void combinations;
    void isSet;
  };
  tryCover(new Set(), 0);
  return best === 99 ? hand.reduce((n, c) => n + Math.min(10, pokerValue(c.rank) === 14 ? 1 : Math.min(10, pokerValue(c.rank))), 0) : best;
}

function pip(c: Card): number {
  const v = pokerValue(c.rank);
  if (v === 14) return 1;
  return Math.min(10, v);
}

export const ginEngine: GameEngine<GinState> = {
  id: "gin-rummy",
  initialState(players) {
    return {
      gameId: "gin-rummy",
      players: players.slice(0, 2).map((p) => ({ ...p, hand: [], score: 0 })),
      current: 0,
      stock: [],
      discard: [],
      phase: "draw",
      drawn: false,
      eventLog: ["Gin rummy. Ten cards. Knock at 10 or less. Gin is a clean hand."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    const next = clone(state);
    if (next.stock.length === 0 && next.players.every((p) => p.hand.length === 0)) {
      const deck = await ctx.shuffle(standardDeck());
      for (let i = 0; i < 10; i++) {
        for (const p of next.players) p.hand.push(deck.pop()!);
      }
      next.discard.push(deck.pop()!);
      next.stock = deck;
    }
    const actor = next.players[next.current];
    if (!actor || actor.id !== playerId) throw new Error("Out of turn");
    if (type === "draw-stock" && next.phase === "draw") {
      if (!next.stock.length) throw new Error("Stock empty");
      actor.hand.push(next.stock.pop()!);
      next.phase = "discard";
      next.drawn = true;
      return next;
    }
    if (type === "draw-discard" && next.phase === "draw") {
      if (!next.discard.length) throw new Error("No discard");
      actor.hand.push(next.discard.pop()!);
      next.phase = "discard";
      next.drawn = true;
      return next;
    }
    if ((type === "discard" || type === "knock" || type === "gin") && next.phase === "discard") {
      const id = typeof payload === "string" ? payload : Array.isArray(payload) ? String(payload[0]) : "";
      const idx = actor.hand.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error("Card not in hand");
      const [card] = actor.hand.splice(idx, 1);
      next.discard.push(card!);
      const dw = deadwood(actor.hand);
      if (type === "gin" && dw !== 0) throw new Error("Not gin");
      if (type === "knock" && dw > 10) throw new Error("Deadwood over 10");
      if (type === "gin" || type === "knock") {
        const opp = next.players.find((p) => p.id !== actor.id)!;
        const oppDw = deadwood(opp.hand);
        const delta = type === "gin" ? 25 + oppDw : Math.max(0, oppDw - dw);
        actor.score += delta;
        next.phase = "complete";
        next.winnerId = actor.id;
        next.eventLog = [...next.eventLog.slice(-24), `${actor.name} ${type}s for ${delta}`];
        return next;
      }
      next.phase = "draw";
      next.current = (next.current + 1) % next.players.length;
      next.eventLog = [...next.eventLog.slice(-24), `${actor.name} discards ${viewCard(card!).label}`];
      return next;
    }
    throw new Error("Illegal action");
  },
  legalActions(state, playerId) {
    const actor = state.players[state.current];
    if (!actor || actor.id !== playerId || state.phase === "complete") return [];
    if (state.phase === "draw") {
      const acts: LegalAction[] = [{ type: "draw-stock", label: "Draw stock" }];
      if (state.discard.length) acts.push({ type: "draw-discard", label: "Take discard" });
      return acts;
    }
    const dw = deadwood(actor.hand);
    const acts: LegalAction[] = actor.hand.map((c) => ({
      type: "discard",
      label: `Discard ${viewCard(c).label}`,
      payload: c.id,
    }));
    if (dw === 0) acts.push({ type: "gin", label: "Gin", payload: actor.hand[0]!.id });
    else if (dw <= 10) acts.push({ type: "knock", label: `Knock (${dw})`, payload: actor.hand[0]!.id });
    return acts;
  },
  isTerminal: (s) => s.phase === "complete",
  scores: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.score])),
  project(state, playerId) {
    const actor = state.players[state.current];
    const mine = state.players.find((p) => p.id === playerId);
    return {
      gameId: "gin-rummy",
      phase: state.phase,
      toAct: actor?.id ?? null,
      prompt: state.phase === "draw" ? "Draw." : "Discard, knock, or gin.",
      scores: this.scores(state),
      legal: this.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerId: state.winnerId,
      myHand: mine?.hand.map(viewCard),
      community: state.discard.slice(-1).map(viewCard),
      seats: state.players,
      eventLog: state.eventLog,
      flags: { deadwood: mine ? deadwood(mine.hand) : 0, pips: mine ? mine.hand.reduce((n, c) => n + pip(c), 0) : 0 },
    } satisfies GameView;
  },
};

export function ginBotAction(state: GinState): { type: string; payload?: ActionPayload } {
  const p = state.players[state.current]!;
  if (state.phase === "draw") return { type: "draw-stock" };
  const dw = deadwood(p.hand);
  const worst = [...p.hand].sort((a, b) => pip(b) - pip(a))[0]!;
  if (dw === 0) return { type: "gin", payload: worst.id };
  if (dw <= 10) return { type: "knock", payload: worst.id };
  return { type: "discard", payload: worst.id };
}
