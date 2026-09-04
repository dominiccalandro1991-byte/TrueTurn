import { SPADES_BAG_PENALTY_AT, SPADES_WIN } from "../../shared/src/constants.ts";
import type { Card } from "./cards.ts";
import { standardDeck, viewCard } from "./cards.ts";
import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";
import { hasSuit, legalFollow, winnerIndex } from "./trick.ts";

export interface SpadesPlayer extends PlayerSeat {
  hand: Card[];
  bid: number | null;
  tricks: number;
}

export interface SpadesState {
  gameId: "spades";
  players: SpadesPlayer[];
  dealer: number;
  toAct: number;
  phase: "deal" | "bidding" | "trick" | "complete";
  trick: { seat: number; card: Card }[];
  lead: number;
  spadesBroken: boolean;
  teamTricks: [number, number];
  teamBags: [number, number];
  teamScore: [number, number];
  eventLog: string[];
  winnerIds?: string[];
}

function teamOf(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

function push(s: SpadesState, m: string) {
  s.eventLog = [...s.eventLog.slice(-24), m];
}

function legalSpadesLead(hand: Card[], broken: boolean): Card[] {
  if (broken) return hand.slice();
  const non = hand.filter((c) => c.suit !== "spades");
  return non.length ? non : hand.slice();
}

function scoreHand(state: SpadesState): SpadesState {
  const next = clone(state);
  for (const team of [0, 1] as const) {
    const a = next.players[team]!;
    const b = next.players[team + 2]!;
    const bid = (a.bid ?? 0) + (b.bid ?? 0);
    const tricks = a.tricks + b.tricks;
    let delta = 0;
    if (a.bid === 0) delta += a.tricks === 0 ? 100 : -100;
    if (b.bid === 0) delta += b.tricks === 0 ? 100 : -100;
    const contractBid = (a.bid === 0 ? 0 : a.bid ?? 0) + (b.bid === 0 ? 0 : b.bid ?? 0);
    if (contractBid > 0) {
      if (tricks >= contractBid) {
        delta += contractBid * 10 + (tricks - contractBid);
        next.teamBags[team] += tricks - contractBid;
      } else {
        delta -= contractBid * 10;
      }
    }
    while (next.teamBags[team] >= SPADES_BAG_PENALTY_AT) {
      delta -= 100;
      next.teamBags[team] -= SPADES_BAG_PENALTY_AT;
    }
    next.teamScore[team] += delta;
  }
  push(next, `Hand over. Us ${next.teamScore[0]} · Them ${next.teamScore[1]}.`);
  if (next.teamScore[0] >= SPADES_WIN || next.teamScore[1] >= SPADES_WIN) {
    next.phase = "complete";
    const winTeam = next.teamScore[0] >= next.teamScore[1] ? 0 : 1;
    next.winnerIds = next.players.filter((p) => teamOf(p.seat) === winTeam).map((p) => p.id);
  } else {
    next.dealer = nextSeat(next.players, next.dealer);
    next.phase = "deal";
    next.players.forEach((p) => {
      p.hand = [];
      p.bid = null;
      p.tricks = 0;
    });
    next.trick = [];
  }
  return next;
}

export const spadesEngine: GameEngine<SpadesState> = {
  id: "spades",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "spades",
      players: players.map((p) => ({ ...p, hand: [], bid: null, tricks: 0 })),
      dealer: 0,
      toAct: 1,
      phase: "deal",
      trick: [],
      lead: 1,
      spadesBroken: false,
      teamTricks: [0, 0],
      teamBags: [0, 0],
      teamScore: [0, 0],
      eventLog: ["Partners sit across. Bid your tricks. Nil is bid 0. First to 500."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    if (type === "deal") {
      if (state.phase !== "deal") throw new Error("Already dealt");
      const next = clone(state);
      const deck = await ctx.shuffle(standardDeck());
      for (let i = 0; i < 52; i++) next.players[i % 4]!.hand.push(deck[i]!);
      next.phase = "bidding";
      next.toAct = nextSeat(next.players, next.dealer);
      push(next, "Thirteen each. Bid.");
      return next;
    }
    const actorSeat = state.players.findIndex((p) => p.id === playerId);
    if (actorSeat !== state.toAct) throw new Error("Out of turn");
    const next = clone(state);
    const actor = next.players[actorSeat]!;
    if (type === "bid") {
      if (next.phase !== "bidding") throw new Error("Not bidding");
      const bid = Number(payload);
      if (!Number.isInteger(bid) || bid < 0 || bid > 13) throw new Error("Bid 0–13");
      actor.bid = bid;
      push(next, `${actor.name} bids ${bid === 0 ? "nil" : bid}.`);
      const nxt = nextSeat(next.players, actorSeat);
      if (next.players[nxt]!.bid !== null && next.players.every((p) => p.bid !== null)) {
        next.phase = "trick";
        next.toAct = nextSeat(next.players, next.dealer);
        next.lead = next.toAct;
      } else {
        next.toAct = nxt;
      }
      return next;
    }
    if (type === "play") {
      if (next.phase !== "trick") throw new Error("Not in tricks");
      const id = String(payload);
      const card = actor.hand.find((c) => c.id === id);
      if (!card) throw new Error("Card not in hand");
      const legal =
        next.trick.length === 0
          ? legalSpadesLead(actor.hand, next.spadesBroken)
          : legalFollow(actor.hand, next.trick, "spades");
      if (!legal.some((c) => c.id === card.id)) throw new Error("Illegal card");
      if (next.trick.length === 0 && card.suit === "spades" && !next.spadesBroken && hasSuit(actor.hand.filter((c) => c.suit !== "spades"), "spades" as never)) {
        /* already filtered */
      }
      actor.hand = actor.hand.filter((c) => c.id !== card.id);
      next.trick.push({ seat: actorSeat, card });
      if (card.suit === "spades" && next.trick.length > 1) next.spadesBroken = true;
      if (card.suit === "spades" && next.trick.length === 1) next.spadesBroken = true;
      if (next.trick.length < 4) {
        next.toAct = nextSeat(next.players, actorSeat);
        return next;
      }
      const win = winnerIndex(next.trick, "spades");
      next.players[win]!.tricks += 1;
      push(next, `${next.players[win]!.name} takes the trick.`);
      next.trick = [];
      next.lead = win;
      next.toAct = win;
      if (next.players.every((p) => p.hand.length === 0)) return scoreHand(next);
      return next;
    }
    throw new Error("Unknown action");
  },
  legalActions(state, playerId) {
    const actions: LegalAction[] = [];
    if (state.phase === "complete") return actions;
    if (state.phase === "deal" && state.players[0]?.id === playerId) {
      actions.push({ type: "deal", label: "Deal" });
      return actions;
    }
    const seat = state.players.findIndex((p) => p.id === playerId);
    if (seat !== state.toAct) return actions;
    if (state.phase === "bidding") {
      for (const n of [0, 1, 2, 3, 4]) {
        actions.push({ type: "bid", label: n === 0 ? "Nil" : `Bid ${n}`, payload: n });
      }
      actions.push({ type: "bid", label: "Bid 5", payload: 5 });
    }
    if (state.phase === "trick") {
      const hand = state.players[seat]!.hand;
      const legal =
        state.trick.length === 0
          ? legalSpadesLead(hand, state.spadesBroken)
          : legalFollow(hand, state.trick, "spades");
      for (const card of legal) {
        actions.push({ type: "play", label: viewCard(card).label, payload: card.id });
      }
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
      gameId: "spades",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : actor?.id ?? null,
      prompt: `Us ${state.teamScore[0]} (bags ${state.teamBags[0]}) · Them ${state.teamScore[1]} (bags ${state.teamBags[1]})`,
      scores: spadesEngine.scores(state),
      legal: spadesEngine.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerIds: state.winnerIds,
      myHand: me?.hand.map(viewCard),
      trick: state.trick.map((t) => ({ seat: t.seat, card: viewCard(t.card) })),
      flags: { bid: me?.bid ?? -1, tricks: me?.tricks ?? 0, broken: state.spadesBroken ? 1 : 0 },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function spadesBotAction(state: SpadesState): { type: string; payload?: ActionPayload } {
  if (state.phase === "deal") return { type: "deal" };
  const actor = state.players[state.toAct]!;
  if (state.phase === "bidding") {
    const spades = actor.hand.filter((c) => c.suit === "spades").length;
    const highs = actor.hand.filter((c) => ["A", "K"].includes(c.rank)).length;
    return { type: "bid", payload: Math.min(13, Math.max(1, Math.round(spades / 2 + highs / 2))) };
  }
  const legal = spadesEngine.legalActions(state, actor.id);
  const play = legal.find((a) => a.type === "play");
  return { type: play?.type ?? "play", payload: play?.payload };
}
