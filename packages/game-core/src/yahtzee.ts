import type { ActionPayload, ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone } from "./engine.ts";

export const YAHTZEE_CATS = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "three-kind",
  "four-kind",
  "full-house",
  "small-straight",
  "large-straight",
  "yahtzee",
  "chance",
] as const;
export type YahtzeeCat = (typeof YAHTZEE_CATS)[number];

export interface YahtzeePlayer extends PlayerSeat {
  card: Partial<Record<YahtzeeCat, number>>;
}

export interface YahtzeeState {
  gameId: "yahtzee";
  players: YahtzeePlayer[];
  current: number;
  rollsLeft: number;
  dice: number[];
  held: boolean[];
  phase: "rolling" | "scoring" | "complete";
  eventLog: string[];
}

function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d] += 1;
  return c;
}
function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}
function isStraight(dice: number[], len: number): boolean {
  const uniq = [...new Set(dice)].sort((a, b) => a - b);
  for (let i = 0; i <= uniq.length - len; i++) {
    let ok = true;
    for (let k = 1; k < len; k++) if (uniq[i + k] !== uniq[i]! + k) ok = false;
    if (ok) return true;
  }
  return false;
}

export function scoreYahtzee(cat: YahtzeeCat, dice: number[]): number {
  const c = counts(dice);
  const n = (face: number) => face * (c[face] ?? 0);
  const max = Math.max(...c);
  switch (cat) {
    case "ones":
      return n(1);
    case "twos":
      return n(2);
    case "threes":
      return n(3);
    case "fours":
      return n(4);
    case "fives":
      return n(5);
    case "sixes":
      return n(6);
    case "three-kind":
      return max >= 3 ? sum(dice) : 0;
    case "four-kind":
      return max >= 4 ? sum(dice) : 0;
    case "full-house":
      return c.includes(3) && c.includes(2) ? 25 : 0;
    case "small-straight":
      return isStraight(dice, 4) ? 30 : 0;
    case "large-straight":
      return isStraight(dice, 5) ? 40 : 0;
    case "yahtzee":
      return max === 5 ? 50 : 0;
    case "chance":
      return sum(dice);
  }
}

function total(p: YahtzeePlayer): number {
  const upper = (["ones", "twos", "threes", "fours", "fives", "sixes"] as const).reduce(
    (a, k) => a + (p.card[k] ?? 0),
    0,
  );
  const lower = YAHTZEE_CATS.filter((k) => !["ones", "twos", "threes", "fours", "fives", "sixes"].includes(k)).reduce(
    (a, k) => a + (p.card[k] ?? 0),
    0,
  );
  return upper + (upper >= 63 ? 35 : 0) + lower;
}

function done(p: YahtzeePlayer): boolean {
  return YAHTZEE_CATS.every((c) => p.card[c] !== undefined);
}

export const yahtzeeEngine: GameEngine<YahtzeeState> = {
  id: "yahtzee",
  initialState(players) {
    return {
      gameId: "yahtzee",
      players: players.map((p) => ({ ...p, card: {} })),
      current: 0,
      rollsLeft: 3,
      dice: [],
      held: [false, false, false, false, false],
      phase: "rolling",
      eventLog: ["Yahtzee. Thirteen boxes. Three rolls."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    const next = clone(state);
    const actor = next.players[next.current];
    if (!actor || actor.id !== playerId) throw new Error("Out of turn");
    if (type === "roll") {
      if (next.phase !== "rolling" || next.rollsLeft <= 0) throw new Error("No rolls left");
      const fresh = await ctx.drawDice(5);
      if (next.dice.length === 0) next.dice = fresh;
      else next.dice = next.dice.map((d, i) => (next.held[i] ? d : fresh[i]!));
      next.rollsLeft -= 1;
      if (next.rollsLeft === 0) next.phase = "scoring";
      next.eventLog = [...next.eventLog.slice(-24), `${actor.name} rolled ${next.dice.join("-")}`];
      return next;
    }
    if (type === "hold") {
      const idx = typeof payload === "number" ? payload : Array.isArray(payload) ? Number(payload[0]) : -1;
      if (idx < 0 || idx > 4 || next.dice.length !== 5) throw new Error("Bad hold");
      next.held[idx] = !next.held[idx];
      return next;
    }
    if (type === "score") {
      const cat =
        typeof payload === "string"
          ? payload
          : payload && typeof payload === "object" && "category" in payload
            ? payload.category
            : "";
      if (!YAHTZEE_CATS.includes(cat as YahtzeeCat)) throw new Error("Unknown box");
      if (actor.card[cat as YahtzeeCat] !== undefined) throw new Error("Box filled");
      if (next.dice.length !== 5) throw new Error("Roll first");
      const pts = scoreYahtzee(cat as YahtzeeCat, next.dice);
      actor.card[cat as YahtzeeCat] = pts;
      next.eventLog = [...next.eventLog.slice(-24), `${actor.name} scores ${cat} for ${pts}`];
      next.dice = [];
      next.held = [false, false, false, false, false];
      next.rollsLeft = 3;
      next.phase = "rolling";
      if (next.players.every(done)) next.phase = "complete";
      else next.current = (next.current + 1) % next.players.length;
      return next;
    }
    throw new Error("Illegal action");
  },
  legalActions(state, playerId) {
    const actor = state.players[state.current];
    if (!actor || actor.id !== playerId || state.phase === "complete") return [];
    const acts: LegalAction[] = [];
    if (state.phase === "rolling" && state.rollsLeft > 0) acts.push({ type: "roll", label: `Roll (${state.rollsLeft})` });
    if (state.dice.length === 5) {
      for (const cat of YAHTZEE_CATS) {
        if (actor.card[cat] === undefined) {
          acts.push({
            type: "score",
            label: `${cat} · ${scoreYahtzee(cat, state.dice)}`,
            payload: { category: cat } as ActionPayload,
          });
        }
      }
    }
    return acts;
  },
  isTerminal: (s) => s.phase === "complete",
  scores: (s) => Object.fromEntries(s.players.map((p) => [p.id, total(p)])),
  project(state, playerId) {
    const actor = state.players[state.current];
    return {
      gameId: "yahtzee",
      phase: state.phase,
      toAct: actor?.id ?? null,
      prompt: state.phase === "complete" ? "Card closed." : `${actor?.name} — ${state.rollsLeft} rolls`,
      scores: this.scores(state),
      legal: this.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerId: state.phase === "complete" ? [...state.players].sort((a, b) => total(b) - total(a))[0]?.id : undefined,
      dice: state.dice,
      selected: state.held.map((h, i) => (h ? i : -1)).filter((i) => i >= 0),
      seats: state.players,
      eventLog: state.eventLog,
      flags: { round: Object.keys(state.players[0]?.card ?? {}).length },
    } satisfies GameView;
  },
};

export function yahtzeeBotAction(state: YahtzeeState): { type: string; payload?: ActionPayload } {
  const p = state.players[state.current]!;
  if (state.dice.length < 5 && state.rollsLeft > 0) return { type: "roll" };
  if (state.rollsLeft > 0 && state.phase === "rolling") {
    const best = YAHTZEE_CATS.filter((c) => p.card[c] === undefined)
      .map((c) => ({ c, s: scoreYahtzee(c, state.dice) }))
      .sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= 25) return { type: "score", payload: { category: best.c } };
    return { type: "roll" };
  }
  const best = YAHTZEE_CATS.filter((c) => p.card[c] === undefined)
    .map((c) => ({ c, s: scoreYahtzee(c, state.dice) }))
    .sort((a, b) => b.s - a.s)[0];
  return { type: "score", payload: { category: best?.c ?? "chance" } };
}
