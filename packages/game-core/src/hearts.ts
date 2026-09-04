import { HEARTS_END_THRESHOLD } from "../../shared/src/constants.ts";
import type { Card } from "./cards.ts";
import { standardDeck, viewCard } from "./cards.ts";
import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";
import { legalFollow, winnerIndex } from "./trick.ts";

const PASS_CYCLE = ["left", "right", "across", "hold"] as const;

export interface HeartsPlayer extends PlayerSeat {
  hand: Card[];
  pile: Card[];
  score: number;
  passed: Card[];
}

export interface HeartsState {
  gameId: "hearts";
  players: HeartsPlayer[];
  dealer: number;
  toAct: number;
  phase: "deal" | "pass" | "trick" | "complete";
  passDir: (typeof PASS_CYCLE)[number];
  round: number;
  trick: { seat: number; card: Card }[];
  heartsBroken: boolean;
  eventLog: string[];
  winnerIds?: string[];
}

function passTarget(seat: number, dir: HeartsState["passDir"]): number {
  if (dir === "left") return (seat + 1) % 4;
  if (dir === "right") return (seat + 3) % 4;
  if (dir === "across") return (seat + 2) % 4;
  return seat;
}

function isHeart(card: Card) {
  return card.suit === "hearts";
}

function isQueenSpades(card: Card) {
  return card.suit === "spades" && card.rank === "Q";
}

function penalty(cards: Card[]): number {
  return cards.reduce((n, c) => n + (isHeart(c) ? 1 : isQueenSpades(c) ? 13 : 0), 0);
}

function legalHearts(hand: Card[], trick: HeartsState["trick"], broken: boolean, firstTrick: boolean): Card[] {
  if (trick.length === 0) {
    if (firstTrick) {
      const two = hand.find((c) => c.rank === "2" && c.suit === "clubs");
      if (two) return [two];
    }
    const nonHearts = hand.filter((c) => !isHeart(c));
    if (!broken && nonHearts.length) return nonHearts;
    return hand.slice();
  }
  const follow = legalFollow(hand, trick, null);
  if (firstTrick) {
    const safe = follow.filter((c) => !isHeart(c) && !isQueenSpades(c));
    if (safe.length) return safe;
  }
  return follow;
}

function push(s: HeartsState, m: string) {
  s.eventLog = [...s.eventLog.slice(-24), m];
}

function scoreRound(state: HeartsState): HeartsState {
  const next = clone(state);
  const penalties = next.players.map((p) => penalty(p.pile));
  const moon = penalties.findIndex((n) => n === 26);
  if (moon >= 0) {
    next.players.forEach((p, i) => {
      p.score += i === moon ? 0 : 26;
    });
    push(next, `${next.players[moon]!.name} shot the moon.`);
  } else {
    next.players.forEach((p, i) => {
      p.score += penalties[i]!;
    });
  }
  if (next.players.some((p) => p.score >= HEARTS_END_THRESHOLD)) {
    next.phase = "complete";
    const low = Math.min(...next.players.map((p) => p.score));
    next.winnerIds = next.players.filter((p) => p.score === low).map((p) => p.id);
    push(next, "Threshold reached. Lowest score wins.");
    return next;
  }
  next.round += 1;
  next.passDir = PASS_CYCLE[next.round % 4]!;
  next.phase = "deal";
  next.heartsBroken = false;
  next.trick = [];
  next.players.forEach((p) => {
    p.hand = [];
    p.pile = [];
    p.passed = [];
  });
  return next;
}

export const heartsEngine: GameEngine<HeartsState> = {
  id: "hearts",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "hearts",
      players: players.map((p) => ({ ...p, hand: [], pile: [], score: 0, passed: [] })),
      dealer: 0,
      toAct: 0,
      phase: "deal",
      passDir: "left",
      round: 0,
      trick: [],
      heartsBroken: false,
      eventLog: ["Pass three, then duck hearts and the queen. Shoot the moon if you dare."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    if (type === "deal") {
      const next = clone(state);
      const deck = await ctx.shuffle(standardDeck());
      for (let i = 0; i < 52; i++) next.players[i % 4]!.hand.push(deck[i]!);
      if (next.passDir === "hold") {
        next.phase = "trick";
        next.toAct = next.players.findIndex((p) => p.hand.some((c) => c.rank === "2" && c.suit === "clubs"));
        push(next, "Hold hand. Two of clubs leads.");
      } else {
        next.phase = "pass";
        next.toAct = 0;
        push(next, `Pass three cards ${next.passDir}.`);
      }
      return next;
    }
    const seat = state.players.findIndex((p) => p.id === playerId);
    const next = clone(state);
    const actor = next.players[seat];
    if (!actor) throw new Error("Not seated");
    if (type === "pass") {
      if (next.phase !== "pass") throw new Error("Not passing");
      if (actor.passed.length) throw new Error("Already passed");
      const ids = payload as string[];
      if (!Array.isArray(ids) || ids.length !== 3) throw new Error("Pass three cards");
      const cards = ids.map((id) => actor.hand.find((c) => c.id === id));
      if (cards.some((c) => !c)) throw new Error("Card not in hand");
      actor.passed = cards as Card[];
      actor.hand = actor.hand.filter((c) => !ids.includes(c.id));
      if (next.players.every((p) => p.passed.length === 3)) {
        for (let i = 0; i < 4; i++) {
          const dest = next.players[passTarget(i, next.passDir)]!;
          dest.hand.push(...next.players[i]!.passed);
        }
        next.phase = "trick";
        next.toAct = next.players.findIndex((p) => p.hand.some((c) => c.rank === "2" && c.suit === "clubs"));
        push(next, "Pass complete. Two of clubs leads.");
      } else {
        next.toAct = next.players.findIndex((p) => p.passed.length === 0);
      }
      return next;
    }
    if (type === "play") {
      if (next.phase !== "trick") throw new Error("Not in tricks");
      if (seat !== next.toAct) throw new Error("Out of turn");
      const inTrickFirst = next.players.every((p) => p.pile.length === 0);
      const id = String(payload);
      const card = actor.hand.find((c) => c.id === id);
      if (!card) throw new Error("Card not in hand");
      const legal = legalHearts(actor.hand, next.trick, next.heartsBroken, inTrickFirst);
      if (!legal.some((c) => c.id === card.id)) throw new Error("Illegal card");
      actor.hand = actor.hand.filter((c) => c.id !== card.id);
      next.trick.push({ seat, card });
      if (isHeart(card) && next.trick.length > 1) next.heartsBroken = true;
      if (next.trick.length < 4) {
        next.toAct = nextSeat(next.players, seat);
        return next;
      }
      const win = winnerIndex(next.trick, null);
      next.players[win]!.pile.push(...next.trick.map((t) => t.card));
      if (next.trick.some((t) => isHeart(t.card))) next.heartsBroken = true;
      push(next, `${next.players[win]!.name} takes the trick.`);
      next.trick = [];
      next.toAct = win;
      if (next.players.every((p) => p.hand.length === 0)) return scoreRound(next);
      return next;
    }
    throw new Error("Unknown action");
  },
  legalActions(state, playerId) {
    const actions: LegalAction[] = [];
    if (state.phase === "complete") return actions;
    if (state.phase === "deal" && state.players[0]?.id === playerId) {
      return [{ type: "deal", label: "Deal" }];
    }
    const seat = state.players.findIndex((p) => p.id === playerId);
    const me = state.players[seat];
    if (!me) return actions;
    if (state.phase === "pass" && me.passed.length === 0) {
      const pick = me.hand.slice(0, 3);
      actions.push({ type: "pass", label: "Pass three", payload: pick.map((c) => c.id) });
    }
    if (state.phase === "trick" && seat === state.toAct) {
      const inTrickFirst = state.players.every((p) => p.pile.length === 0);
      const legal = legalHearts(me.hand, state.trick, state.heartsBroken, inTrickFirst);
      for (const card of legal) actions.push({ type: "play", label: viewCard(card).label, payload: card.id });
    }
    return actions;
  },
  isTerminal(state) {
    return state.phase === "complete";
  },
  scores(state) {
    return Object.fromEntries(state.players.map((p) => [p.id, p.score]));
  },
  project(state, playerId): GameView {
    const actor = state.players[state.toAct];
    const me = state.players.find((p) => p.id === playerId);
    return {
      gameId: "hearts",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : actor?.id ?? null,
      prompt: state.phase === "pass" ? `Pass three ${state.passDir}` : "Avoid hearts. Queen of spades is 13.",
      scores: heartsEngine.scores(state),
      legal: heartsEngine.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerIds: state.winnerIds,
      myHand: me?.hand.map(viewCard),
      trick: state.trick.map((t) => ({ seat: t.seat, card: viewCard(t.card) })),
      flags: { broken: state.heartsBroken ? 1 : 0, pass: state.passDir },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function heartsBotAction(state: HeartsState): { type: string; payload?: ActionPayload } {
  if (state.phase === "deal") return { type: "deal" };
  const actor = state.players[state.toAct]!;
  if (state.phase === "pass") {
    const worst = [...actor.hand]
      .sort((a, b) => (isQueenSpades(b) ? 1 : 0) - (isQueenSpades(a) ? 1 : 0) || (isHeart(b) ? 1 : 0) - (isHeart(a) ? 1 : 0))
      .slice(0, 3);
    return { type: "pass", payload: worst.map((c) => c.id) };
  }
  const legal = heartsEngine.legalActions(state, actor.id).filter((a) => a.type === "play");
  const safe = legal.find((a) => !String(a.label).includes("♥") && a.label !== "Q♠") ?? legal[0];
  return { type: "play", payload: safe?.payload };
}
