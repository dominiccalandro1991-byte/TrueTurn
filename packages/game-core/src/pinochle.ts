import { PINOCHLE_MIN_BID } from "../../shared/src/constants.ts";
import type { Card, Suit } from "./cards.ts";
import { PINOCHLE_TRICK_VALUE, pinochleDeck, viewCard } from "./cards.ts";
import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";
import { legalPinochle, winnerIndex } from "./trick.ts";

export interface PinochlePlayer extends PlayerSeat {
  hand: Card[];
  captured: Card[];
  bid: number | null;
  meld: number;
}

export interface PinochleState {
  gameId: "pinochle";
  players: PinochlePlayer[];
  dealer: number;
  toAct: number;
  phase: "deal" | "bidding" | "trump" | "trick" | "complete";
  trump: Suit | null;
  bidder: number | null;
  trick: { seat: number; card: Card }[];
  teamMeld: [number, number];
  teamTricks: [number, number];
  eventLog: string[];
  winnerIds?: string[];
}

function teamOf(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

function push(s: PinochleState, m: string) {
  s.eventLog = [...s.eventLog.slice(-24), m];
}

export function scoreMeld(hand: Card[], trump: Suit): number {
  let total = 0;
  const bySuit: Record<Suit, Record<string, number>> = {
    spades: {},
    hearts: {},
    diamonds: {},
    clubs: {},
  };
  for (const c of hand) {
    bySuit[c.suit][c.rank] = (bySuit[c.suit][c.rank] ?? 0) + 1;
  }
  const countRank = (rank: string) =>
    (bySuit.spades[rank] ?? 0) +
    (bySuit.hearts[rank] ?? 0) +
    (bySuit.diamonds[rank] ?? 0) +
    (bySuit.clubs[rank] ?? 0);
  const around = (rank: string) =>
    (bySuit.spades[rank] ?? 0) >= 1 &&
    (bySuit.hearts[rank] ?? 0) >= 1 &&
    (bySuit.diamonds[rank] ?? 0) >= 1 &&
    (bySuit.clubs[rank] ?? 0) >= 1;

  const run =
    (bySuit[trump].A ?? 0) >= 1 &&
    (bySuit[trump]["10"] ?? 0) >= 1 &&
    (bySuit[trump].K ?? 0) >= 1 &&
    (bySuit[trump].Q ?? 0) >= 1 &&
    (bySuit[trump].J ?? 0) >= 1;
  if (run) total += 150;
  else if ((bySuit[trump].K ?? 0) >= 1 && (bySuit[trump].Q ?? 0) >= 1) total += 40;

  for (const suit of ["spades", "hearts", "diamonds", "clubs"] as const) {
    if (suit === trump) continue;
    if ((bySuit[suit].K ?? 0) >= 1 && (bySuit[suit].Q ?? 0) >= 1) total += 20;
  }

  const jd = bySuit.diamonds.J ?? 0;
  const qs = bySuit.spades.Q ?? 0;
  const pinochles = Math.min(jd, qs);
  if (pinochles >= 2) total += 300;
  else if (pinochles === 1) total += 40;

  if (around("A")) total += 100;
  if (around("K")) total += 80;
  if (around("Q")) total += 60;
  if (around("J")) total += 40;
  if ((bySuit[trump]["9"] ?? 0) >= 1) total += 10;
  void countRank;
  return total;
}

function finish(state: PinochleState): PinochleState {
  const next = clone(state);
  const trickPts: [number, number] = [0, 0];
  for (const p of next.players) {
    for (const c of p.captured) trickPts[teamOf(p.seat)] += PINOCHLE_TRICK_VALUE[c.rank] ?? 0;
  }
  // Last trick already included in captured; add last-trick bonus to last capturer via event — assigned when last trick taken.
  next.teamTricks = trickPts;
  const total0 = next.teamMeld[0] + trickPts[0];
  const total1 = next.teamMeld[1] + trickPts[1];
  next.phase = "complete";
  const win = total0 >= total1 ? 0 : 1;
  next.winnerIds = next.players.filter((p) => teamOf(p.seat) === win).map((p) => p.id);
  push(next, `Meld+tricks Us ${total0} · Them ${total1}.`);
  return next;
}

export const pinochleEngine: GameEngine<PinochleState> = {
  id: "pinochle",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "pinochle",
      players: players.map((p) => ({ ...p, hand: [], captured: [], bid: null, meld: 0 })),
      dealer: 0,
      toAct: 1,
      phase: "deal",
      trump: null,
      bidder: null,
      trick: [],
      teamMeld: [0, 0],
      teamTricks: [0, 0],
      eventLog: ["Single-deck pinochle. Min bid 250. Must follow, trump if void, beat if you can."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    if (type === "deal") {
      const next = clone(state);
      const deck = await ctx.shuffle(pinochleDeck());
      for (let i = 0; i < 48; i++) next.players[i % 4]!.hand.push(deck[i]!);
      next.phase = "bidding";
      next.toAct = nextSeat(next.players, next.dealer);
      push(next, "Twelve each. Bid from 250.");
      return next;
    }
    const seat = state.players.findIndex((p) => p.id === playerId);
    if (seat !== state.toAct) throw new Error("Out of turn");
    const next = clone(state);
    const actor = next.players[seat]!;
    if (type === "bid" || type === "pass") {
      if (next.phase !== "bidding") throw new Error("Not bidding");
      const high = Math.max(0, ...next.players.map((p) => p.bid ?? 0));
      if (type === "pass") actor.bid = 0;
      else {
        const bid = Number(payload);
        const min = Math.max(PINOCHLE_MIN_BID, high + 10);
        if (bid < min) throw new Error(`Bid at least ${min}`);
        actor.bid = bid;
      }
      push(next, `${actor.name} ${actor.bid === 0 ? "passes" : `bids ${actor.bid}`}.`);
      const nxt = nextSeat(next.players, seat);
      if (next.players.every((p) => p.bid !== null)) {
        const best = Math.max(...next.players.map((p) => p.bid ?? 0));
        next.bidder = best === 0 ? next.dealer : next.players.findIndex((p) => p.bid === best);
        if (best === 0) next.players[next.dealer]!.bid = PINOCHLE_MIN_BID;
        next.phase = "trump";
        next.toAct = next.bidder;
      } else next.toAct = nxt;
      return next;
    }
    if (type === "trump") {
      const suit = String(payload) as Suit;
      next.trump = suit;
      for (const p of next.players) {
        p.meld = scoreMeld(p.hand, suit);
        next.teamMeld[teamOf(p.seat)] += p.meld;
      }
      next.phase = "trick";
      next.toAct = next.bidder!;
      push(next, `Trump ${suit}. Meld Us ${next.teamMeld[0]} · Them ${next.teamMeld[1]}.`);
      return next;
    }
    if (type === "play") {
      if (!next.trump) throw new Error("No trump");
      const id = String(payload);
      const card = actor.hand.find((c) => c.id === id);
      if (!card) throw new Error("Card not in hand");
      const legal = legalPinochle(actor.hand, next.trick, next.trump);
      if (!legal.some((c) => c.id === card.id)) throw new Error("Must follow, trump, or beat");
      actor.hand = actor.hand.filter((c) => c.id !== card.id);
      next.trick.push({ seat, card });
      if (next.trick.length < 4) {
        next.toAct = nextSeat(next.players, seat);
        return next;
      }
      const win = winnerIndex(next.trick, next.trump, "pinochle");
      next.players[win]!.captured.push(...next.trick.map((t) => t.card));
      const lastTrick = next.players.every((p) => p.hand.length === 0);
      if (lastTrick) {
        // last trick 10 points — encoded as a phantom by adding a dummy? We add 10 via a special captured marker using extra Ace value — instead stash as extra captured 10 via event and teamTricks later.
        next.players[win]!.captured.push({ id: "last_trick_bonus", suit: next.trump, rank: "10" });
      }
      push(next, `${next.players[win]!.name} takes the trick.`);
      next.trick = [];
      next.toAct = win;
      if (lastTrick) return finish(next);
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
      const min = Math.max(PINOCHLE_MIN_BID, high + 10);
      actions.push({ type: "pass", label: "Pass" });
      actions.push({ type: "bid", label: `Bid ${min}`, payload: min });
    }
    if (state.phase === "trump") {
      for (const suit of ["spades", "hearts", "diamonds", "clubs"] as const) {
        actions.push({ type: "trump", label: `Trump ${suit}`, payload: suit });
      }
    }
    if (state.phase === "trick" && state.trump) {
      const legal = legalPinochle(state.players[seat]!.hand, state.trick, state.trump);
      for (const card of legal) actions.push({ type: "play", label: viewCard(card).label, payload: card.id });
    }
    return actions;
  },
  isTerminal(state) {
    return state.phase === "complete";
  },
  scores(state) {
    return Object.fromEntries(
      state.players.map((p) => [p.id, state.teamMeld[teamOf(p.seat)] + state.teamTricks[teamOf(p.seat)]]),
    );
  },
  project(state, playerId): GameView {
    const actor = state.players[state.toAct];
    const me = state.players.find((p) => p.id === playerId);
    return {
      gameId: "pinochle",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : actor?.id ?? null,
      prompt: `Meld Us ${state.teamMeld[0]} · Them ${state.teamMeld[1]}${state.trump ? ` · trump ${state.trump}` : ""}`,
      scores: pinochleEngine.scores(state),
      legal: pinochleEngine.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerIds: state.winnerIds,
      myHand: me?.hand.map(viewCard),
      trick: state.trick.map((t) => ({ seat: t.seat, card: viewCard(t.card) })),
      flags: { trump: state.trump ?? "", meld: me?.meld ?? 0 },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function pinochleBotAction(state: PinochleState): { type: string; payload?: ActionPayload } {
  if (state.phase === "deal") return { type: "deal" };
  const actor = state.players[state.toAct]!;
  if (state.phase === "bidding") return { type: "pass" };
  if (state.phase === "trump") {
    const counts: Record<string, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
    for (const c of actor.hand) counts[c.suit] += 1;
    return { type: "trump", payload: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0] };
  }
  const play = pinochleEngine.legalActions(state, actor.id).find((a) => a.type === "play");
  return { type: "play", payload: play?.payload };
}
