import { PITCH_WIN } from "../../shared/src/constants.ts";
import type { Card, Suit } from "./cards.ts";
import { PITCH_GAME_VALUE, standardDeck, viewCard } from "./cards.ts";
import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";
import { legalFollow, winnerIndex } from "./trick.ts";

export interface PitchPlayer extends PlayerSeat {
  hand: Card[];
  captured: Card[];
  bid: number | null;
}

export interface PitchState {
  gameId: "pitch";
  players: PitchPlayer[];
  dealer: number;
  toAct: number;
  phase: "deal" | "bidding" | "trump" | "trick" | "complete";
  trump: Suit | null;
  bidder: number | null;
  trick: { seat: number; card: Card }[];
  teamScore: [number, number];
  eventLog: string[];
  winnerIds?: string[];
}

function teamOf(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

function push(s: PitchState, m: string) {
  s.eventLog = [...s.eventLog.slice(-24), m];
}

function scorePitch(state: PitchState): PitchState {
  const next = clone(state);
  const trump = next.trump!;
  const all = next.players.flatMap((p, seat) => p.captured.map((c) => ({ seat, card: c })));
  const trumpCards = all.filter((x) => x.card.suit === trump);
  const high =
    trumpCards.slice().sort((a, b) => rankPitch(b.card) - rankPitch(a.card))[0] ?? null;
  const low =
    trumpCards.slice().sort((a, b) => rankPitch(a.card) - rankPitch(b.card))[0] ?? null;
  const jack = trumpCards.find((x) => x.card.rank === "J") ?? null;
  const gamePts = [0, 0, 0, 0];
  for (const p of next.players) {
    for (const c of p.captured) gamePts[p.seat] += PITCH_GAME_VALUE[c.rank] ?? 0;
  }
  const gameTeam0 = gamePts[0]! + gamePts[2]!;
  const gameTeam1 = gamePts[1]! + gamePts[3]!;
  const points: [number, number] = [0, 0];
  if (high) points[teamOf(high.seat)] += 1;
  if (low) points[teamOf(low.seat)] += 1;
  if (jack) points[teamOf(jack.seat)] += 1;
  if (gameTeam0 !== gameTeam1) points[gameTeam0 > gameTeam1 ? 0 : 1] += 1;
  const bid = next.players[next.bidder!]!.bid ?? 0;
  const bidTeam = teamOf(next.bidder!);
  if (points[bidTeam] >= bid) next.teamScore[bidTeam] += points[bidTeam];
  else next.teamScore[bidTeam] -= bid;
  const other = (1 - bidTeam) as 0 | 1;
  next.teamScore[other] += points[other];
  push(next, `Pitch scored. Us ${next.teamScore[0]} · Them ${next.teamScore[1]}.`);
  if (next.teamScore[0] >= PITCH_WIN || next.teamScore[1] >= PITCH_WIN) {
    next.phase = "complete";
    const win = next.teamScore[0] >= next.teamScore[1] ? 0 : 1;
    next.winnerIds = next.players.filter((p) => teamOf(p.seat) === win).map((p) => p.id);
  } else {
    next.phase = "deal";
    next.dealer = nextSeat(next.players, next.dealer);
    next.trump = null;
    next.bidder = null;
    next.trick = [];
    next.players.forEach((p) => {
      p.hand = [];
      p.captured = [];
      p.bid = null;
    });
  }
  return next;
}

function rankPitch(card: Card): number {
  const order: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2 };
  return order[card.rank] ?? 0;
}

export const pitchEngine: GameEngine<PitchState> = {
  id: "pitch",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "pitch",
      players: players.map((p) => ({ ...p, hand: [], captured: [], bid: null })),
      dealer: 0,
      toAct: 1,
      phase: "deal",
      trump: null,
      bidder: null,
      trick: [],
      teamScore: [0, 0],
      eventLog: ["Six cards. Bid 2–4. High, Low, Jack, Game. First team to 11."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    if (type === "deal") {
      const next = clone(state);
      const deck = await ctx.shuffle(standardDeck());
      for (let i = 0; i < 24; i++) next.players[i % 4]!.hand.push(deck[i]!);
      next.phase = "bidding";
      next.toAct = nextSeat(next.players, next.dealer);
      push(next, "Six each. Bid.");
      return next;
    }
    const seat = state.players.findIndex((p) => p.id === playerId);
    if (seat !== state.toAct) throw new Error("Out of turn");
    const next = clone(state);
    const actor = next.players[seat]!;
    if (type === "bid" || type === "pass") {
      if (next.phase !== "bidding") throw new Error("Not bidding");
      const bid = type === "pass" ? 0 : Number(payload);
      if (type !== "pass" && (bid < 2 || bid > 4)) throw new Error("Bid 2–4");
      actor.bid = bid;
      const currentHigh = Math.max(...next.players.map((p) => p.bid ?? 0));
      if (bid > 0 && bid < currentHigh && bid !== currentHigh) {
        /* allow equal only if later — keep simple: must exceed */
      }
      push(next, `${actor.name} ${bid === 0 ? "passes" : `bids ${bid}`}.`);
      const nxt = nextSeat(next.players, seat);
      if (next.players.every((p) => p.bid !== null)) {
        const high = Math.max(...next.players.map((p) => p.bid ?? 0));
        if (high === 0) {
          next.players[next.dealer]!.bid = 2;
          next.bidder = next.dealer;
        } else {
          next.bidder = next.players.findIndex((p) => p.bid === high);
        }
        next.phase = "trump";
        next.toAct = next.bidder;
        push(next, `${next.players[next.bidder]!.name} names trump.`);
      } else next.toAct = nxt;
      return next;
    }
    if (type === "trump") {
      if (next.phase !== "trump") throw new Error("Not naming trump");
      const suit = String(payload) as Suit;
      if (!["spades", "hearts", "diamonds", "clubs"].includes(suit)) throw new Error("Invalid suit");
      next.trump = suit;
      next.phase = "trick";
      next.toAct = next.bidder!;
      push(next, `Trump is ${suit}.`);
      return next;
    }
    if (type === "play") {
      if (next.phase !== "trick") throw new Error("Not in tricks");
      const id = String(payload);
      const card = actor.hand.find((c) => c.id === id);
      if (!card) throw new Error("Card not in hand");
      const legal = legalFollow(actor.hand, next.trick, next.trump);
      if (next.trick.length > 0 && !legal.some((c) => c.id === card.id)) throw new Error("Must follow");
      actor.hand = actor.hand.filter((c) => c.id !== card.id);
      next.trick.push({ seat, card });
      if (next.trick.length < 4) {
        next.toAct = nextSeat(next.players, seat);
        return next;
      }
      const win = winnerIndex(next.trick, next.trump);
      next.players[win]!.captured.push(...next.trick.map((t) => t.card));
      push(next, `${next.players[win]!.name} takes the trick.`);
      next.trick = [];
      next.toAct = win;
      if (next.players.every((p) => p.hand.length === 0)) return scorePitch(next);
      return next;
    }
    throw new Error("Unknown action");
  },
  legalActions(state, playerId) {
    const actions: LegalAction[] = [];
    if (state.phase === "complete") return actions;
    if (state.phase === "deal" && state.players[0]?.id === playerId) return [{ type: "deal", label: "Deal" }];
    const seat = state.players.findIndex((p) => p.id === playerId);
    if (seat !== state.toAct) return actions;
    if (state.phase === "bidding") {
      const high = Math.max(0, ...state.players.map((p) => p.bid ?? 0));
      actions.push({ type: "pass", label: "Pass" });
      for (const n of [2, 3, 4]) {
        if (n > high) actions.push({ type: "bid", label: `Bid ${n}`, payload: n });
      }
    }
    if (state.phase === "trump") {
      for (const suit of ["spades", "hearts", "diamonds", "clubs"] as const) {
        actions.push({ type: "trump", label: `Trump ${suit}`, payload: suit });
      }
    }
    if (state.phase === "trick") {
      const hand = state.players[seat]!.hand;
      const legal = state.trick.length ? legalFollow(hand, state.trick, state.trump) : hand;
      for (const card of legal) actions.push({ type: "play", label: viewCard(card).label, payload: card.id });
    }
    return actions;
  },
  isTerminal(state) {
    return state.phase === "complete";
  },
  scores(state) {
    return Object.fromEntries(state.players.map((p) => [p.id, state.teamScore[teamOf(p.seat)]]));
  },
  project(state, playerId): GameView {
    const actor = state.players[state.toAct];
    const me = state.players.find((p) => p.id === playerId);
    return {
      gameId: "pitch",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : actor?.id ?? null,
      prompt: `Us ${state.teamScore[0]} · Them ${state.teamScore[1]}${state.trump ? ` · trump ${state.trump}` : ""}`,
      scores: pitchEngine.scores(state),
      legal: pitchEngine.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerIds: state.winnerIds,
      myHand: me?.hand.map(viewCard),
      trick: state.trick.map((t) => ({ seat: t.seat, card: viewCard(t.card) })),
      flags: { trump: state.trump ?? "", bid: me?.bid ?? -1 },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function pitchBotAction(state: PitchState): { type: string; payload?: ActionPayload } {
  if (state.phase === "deal") return { type: "deal" };
  const actor = state.players[state.toAct]!;
  if (state.phase === "bidding") {
    const aces = actor.hand.filter((c) => c.rank === "A").length;
    return aces >= 1 ? { type: "bid", payload: 2 } : { type: "pass" };
  }
  if (state.phase === "trump") {
    const counts: Record<string, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
    for (const c of actor.hand) counts[c.suit] += 1;
    const suit = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["spades"])[0];
    return { type: "trump", payload: suit };
  }
  const play = pitchEngine.legalActions(state, actor.id).find((a) => a.type === "play");
  return { type: "play", payload: play?.payload };
}
