import { HOLDEM_BIG_BLIND, HOLDEM_SMALL_BLIND, HOLDEM_STARTING_STACK } from "../../shared/src/constants.ts";
import type { Card } from "./cards.ts";
import { standardDeck, viewCard } from "./cards.ts";
import type { ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";
import { bestOfSeven, categoryLabel, compareHands } from "./poker.ts";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown" | "complete";

export interface HoldemPlayer extends PlayerSeat {
  stack: number;
  bet: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  acted: boolean;
}

export interface HoldemState {
  gameId: "holdem";
  players: HoldemPlayer[];
  dealer: number;
  toAct: number;
  street: Street;
  community: Card[];
  deck: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  eventLog: string[];
  winnerIds?: string[];
  showdown?: { id: string; label: string }[];
}

function live(state: HoldemState): HoldemPlayer[] {
  return state.players.filter((p) => !p.folded);
}

function needsAction(p: HoldemPlayer, currentBet: number): boolean {
  if (p.folded || p.allIn) return false;
  return !p.acted || p.bet < currentBet;
}

function nextActor(state: HoldemState, from: number): number | null {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (needsAction(state.players[idx]!, state.currentBet)) return idx;
  }
  return null;
}

function push(state: HoldemState, msg: string) {
  state.eventLog = [...state.eventLog.slice(-28), msg];
}

function post(state: HoldemState, seat: number, amount: number) {
  const p = state.players[seat]!;
  const put = Math.min(amount, p.stack);
  p.stack -= put;
  p.bet += put;
  state.pot += put;
  if (p.stack === 0) p.allIn = true;
}

function bettingClosed(state: HoldemState): boolean {
  const active = live(state).filter((p) => !p.allIn);
  if (active.length <= 1 && live(state).length >= 1) {
    return live(state).every((p) => p.acted || p.allIn || p.folded);
  }
  return live(state).every((p) => p.folded || p.allIn || (p.acted && p.bet === state.currentBet));
}

async function dealCommunity(state: HoldemState, count: number, ctx: ApplyContext) {
  if (state.deck.length < count) state.deck = await ctx.shuffle(standardDeck());
  state.community.push(...state.deck.splice(0, count));
}

async function advanceStreet(state: HoldemState, ctx: ApplyContext): Promise<HoldemState> {
  const next = clone(state);
  next.players.forEach((p) => {
    p.bet = 0;
    p.acted = false;
  });
  next.currentBet = 0;
  next.minRaise = HOLDEM_BIG_BLIND;
  if (next.street === "preflop") {
    next.street = "flop";
    await dealCommunity(next, 3, ctx);
    push(next, `Flop ${next.community.map((c) => viewCard(c).label).join(" ")}`);
  } else if (next.street === "flop") {
    next.street = "turn";
    await dealCommunity(next, 1, ctx);
    push(next, `Turn ${viewCard(next.community[3]!).label}`);
  } else if (next.street === "turn") {
    next.street = "river";
    await dealCommunity(next, 1, ctx);
    push(next, `River ${viewCard(next.community[4]!).label}`);
  } else {
    return showdown(next);
  }
  const actor = nextActor({ ...next, currentBet: 0 }, next.dealer);
  next.toAct = actor ?? next.dealer;
  if (live(next).filter((p) => !p.allIn).length <= 1) return advanceStreet(next, ctx);
  return next;
}

function showdown(state: HoldemState): HoldemState {
  const next = clone(state);
  const contenders = live(next);
  const ranked = contenders.map((p) => ({
    p,
    hand: bestOfSeven([...p.hole, ...next.community]),
  }));
  ranked.sort((a, b) => compareHands(b.hand, a.hand));
  const best = ranked[0]!;
  const winners = ranked.filter((r) => compareHands(r.hand, best.hand) === 0);
  const share = Math.floor(next.pot / winners.length);
  for (const w of winners) w.p.stack += share;
  next.pot = 0;
  next.street = "complete";
  next.winnerIds = winners.map((w) => w.p.id);
  next.showdown = ranked.map((r) => ({
    id: r.p.id,
    label: `${r.p.name}: ${categoryLabel(r.hand.category)}`,
  }));
  push(next, `Showdown. ${winners.map((w) => w.p.name).join(" & ")} take the pot.`);
  return next;
}

function foldWin(state: HoldemState): HoldemState | null {
  const remaining = live(state);
  if (remaining.length !== 1) return null;
  const next = clone(state);
  remaining[0]!.stack += next.pot;
  next.pot = 0;
  next.street = "complete";
  next.winnerIds = [remaining[0]!.id];
  push(next, `${remaining[0]!.name} wins uncontested.`);
  return next;
}

export const holdemEngine: GameEngine<HoldemState> = {
  id: "holdem",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "holdem",
      players: players.map((p) => ({
        ...p,
        stack: HOLDEM_STARTING_STACK,
        bet: 0,
        hole: [],
        folded: false,
        allIn: false,
        acted: false,
      })),
      dealer: 0,
      toAct: 0,
      street: "preflop",
      community: [],
      deck: [],
      pot: 0,
      currentBet: HOLDEM_BIG_BLIND,
      minRaise: HOLDEM_BIG_BLIND,
      eventLog: ["Hold’em. Blinds 5 / 10. Best five-card hand."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    if (state.street === "complete") throw new Error("Match is complete");
    if (type === "deal") {
      if (state.players[0]?.id !== playerId) throw new Error("Only the opener may deal");
      if (state.players.some((p) => p.hole.length > 0)) throw new Error("Already dealt");
      const next = clone(state);
      next.deck = await ctx.shuffle(standardDeck());
      for (const p of next.players) p.hole = next.deck.splice(0, 2);
      const sb = nextSeat(next.players, next.dealer);
      const bb = nextSeat(next.players, sb);
      post(next, sb, HOLDEM_SMALL_BLIND);
      post(next, bb, HOLDEM_BIG_BLIND);
      next.currentBet = HOLDEM_BIG_BLIND;
      next.toAct = nextSeat(next.players, bb);
      next.players[sb]!.acted = false;
      next.players[bb]!.acted = false;
      push(next, "Cards in. Blinds posted.");
      return next;
    }
    const actor = state.players[state.toAct];
    if (!actor || actor.id !== playerId) throw new Error("Out of turn");
    const next = clone(state);
    const p = next.players[next.toAct]!;
    if (type === "fold") {
      p.folded = true;
      p.acted = true;
      push(next, `${p.name} folds.`);
      const ended = foldWin(next);
      if (ended) return ended;
    } else if (type === "check") {
      if (p.bet < next.currentBet) throw new Error("Cannot check");
      p.acted = true;
      push(next, `${p.name} checks.`);
    } else if (type === "call") {
      const need = next.currentBet - p.bet;
      post(next, next.toAct, need);
      p.acted = true;
      push(next, `${p.name} calls.`);
    } else if (type === "bet" || type === "raise") {
      const amount = Number((payload as { amount?: number } | undefined)?.amount ?? next.minRaise);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid bet");
      const raiseTo = type === "bet" && next.currentBet === 0 ? amount : next.currentBet + amount;
      const need = raiseTo - p.bet;
      if (need > p.stack) throw new Error("Bet exceeds stack");
      if (next.currentBet > 0 && amount < next.minRaise && need < p.stack) throw new Error("Raise too small");
      post(next, next.toAct, need);
      next.minRaise = Math.max(next.minRaise, raiseTo - next.currentBet);
      next.currentBet = p.bet;
      next.players.forEach((o) => {
        if (!o.folded && o.id !== p.id && !o.allIn) o.acted = false;
      });
      p.acted = true;
      push(next, `${p.name} ${type === "bet" ? "bets" : "raises to"} ${p.bet}.`);
    } else {
      throw new Error("Unknown action");
    }
    if (bettingClosed(next)) return advanceStreet(next, ctx);
    const nxt = nextActor(next, next.toAct);
    if (nxt === null) return advanceStreet(next, ctx);
    next.toAct = nxt;
    return next;
  },
  legalActions(state, playerId) {
    const actions: LegalAction[] = [];
    if (state.street === "complete") return actions;
    if (state.players.every((p) => p.hole.length === 0)) {
      if (state.players[0]?.id === playerId) actions.push({ type: "deal", label: "Deal" });
      return actions;
    }
    const actor = state.players[state.toAct];
    if (!actor || actor.id !== playerId) return actions;
    actions.push({ type: "fold", label: "Fold" });
    const need = state.currentBet - actor.bet;
    if (need <= 0) actions.push({ type: "check", label: "Check" });
    else actions.push({ type: "call", label: `Call ${Math.min(need, actor.stack)}` });
    const min = state.currentBet === 0 ? HOLDEM_BIG_BLIND : state.minRaise;
    if (actor.stack > need) {
      actions.push({
        type: state.currentBet === 0 ? "bet" : "raise",
        label: state.currentBet === 0 ? `Bet ${min}` : `Raise ${min}`,
        payload: { amount: min },
      });
    }
    return actions;
  },
  isTerminal(state) {
    return state.street === "complete";
  },
  scores(state) {
    return Object.fromEntries(state.players.map((p) => [p.id, p.stack]));
  },
  project(state, playerId): GameView {
    const actor = state.players[state.toAct];
    const me = state.players.find((p) => p.id === playerId);
    return {
      gameId: "holdem",
      phase: state.street,
      toAct: state.street === "complete" ? null : actor?.id ?? null,
      prompt:
        state.street === "complete"
          ? (state.showdown ?? []).map((s) => s.label).join(" · ") || "Pot awarded."
          : `${actor?.name ?? "Player"} to act · pot ${state.pot}`,
      scores: holdemEngine.scores(state),
      legal: holdemEngine.legalActions(state, playerId),
      terminal: state.street === "complete",
      winnerIds: state.winnerIds,
      community: state.community.map(viewCard),
      myHand: me?.hole.map(viewCard),
      hiddenCounts: Object.fromEntries(
        state.players.filter((p) => p.id !== playerId).map((p) => [p.id, p.folded ? 0 : p.hole.length]),
      ),
      pot: state.pot,
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function holdemBotAction(state: HoldemState): { type: string; payload?: { amount: number } } {
  if (state.players.every((p) => p.hole.length === 0)) return { type: "deal" };
  const actor = state.players[state.toAct]!;
  const hole = actor.hole;
  const values = hole.map((c) => c.rank);
  const suited = hole[0]?.suit === hole[1]?.suit;
  const premium = values.includes("A") || values.includes("K") || (values[0] === values[1] && hole.length === 2);
  const need = state.currentBet - actor.bet;
  if (need > 0 && !premium && need > actor.stack * 0.25) return { type: "fold" };
  if (need <= 0) {
    if (premium && suited) return { type: "bet", payload: { amount: HOLDEM_BIG_BLIND } };
    return { type: "check" };
  }
  return { type: "call" };
}
