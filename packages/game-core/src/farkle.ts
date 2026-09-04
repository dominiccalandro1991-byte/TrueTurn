import { FARKLE_GOAL, FARKLE_OPENING_MINIMUM } from "../../shared/src/constants.ts";
import type { ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";
import { isHotDice, scoreDice, selectionValid } from "./farkle-score.ts";

export type { ScoreBreakdown } from "./farkle-score.ts";
export { isFarkle, isHotDice, scoreDice, selectionValid } from "./farkle-score.ts";

export interface FarklePlayer {
  id: string;
  name: string;
  seat: number;
  isBot: boolean;
  banked: number;
  hasOpened: boolean;
}

export interface FarkleState {
  gameId: "farkle";
  version: number;
  players: FarklePlayer[];
  current: number;
  phase: "rolling" | "selecting" | "complete";
  dice: number[];
  selected: number[];
  remaining: number;
  turnScore: number;
  rollsThisTurn: number;
  eventLog: string[];
  winnerId?: string;
  lastFarkle?: boolean;
}

function currentPlayer(state: FarkleState): FarklePlayer {
  return state.players[state.current]!;
}

function push(state: FarkleState, message: string): void {
  state.eventLog = [...state.eventLog.slice(-24), message];
}

async function roll(state: FarkleState, ctx: ApplyContext, count: number): Promise<FarkleState> {
  const next = clone(state);
  const player = currentPlayer(next);
  next.dice = await ctx.drawDice(count);
  next.selected = [];
  next.remaining = count;
  next.rollsThisTurn += 1;
  next.lastFarkle = false;
  const scored = scoreDice(next.dice);
  if (scored.score === 0) {
    next.turnScore = 0;
    next.lastFarkle = true;
    push(next, `${player.name} farkled.`);
    next.current = nextSeat(next.players, next.current);
    next.remaining = 6;
    next.dice = [];
    next.rollsThisTurn = 0;
    next.phase = "rolling";
    return maybeComplete(next);
  }
  next.phase = "selecting";
  push(next, `${player.name} rolled ${next.dice.join("–")}.`);
  return next;
}

function maybeComplete(state: FarkleState): FarkleState {
  const winner = state.players.find((p) => p.banked >= FARKLE_GOAL);
  if (winner) {
    state.phase = "complete";
    state.winnerId = winner.id;
    push(state, `${winner.name} wins with ${winner.banked}.`);
  }
  return state;
}

export const farkleEngine: GameEngine<FarkleState> = {
  id: "farkle",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "farkle",
      version: 0,
      players: players.map((p) => ({ ...p, banked: 0, hasOpened: false })),
      current: 0,
      phase: "rolling",
      dice: [],
      selected: [],
      remaining: 6,
      turnScore: 0,
      rollsThisTurn: 0,
      eventLog: ["Table set. First to 10,000. Bank 500 to open."],
    };
  },
  async apply(state, playerId, type, payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    const actor = currentPlayer(state);
    if (actor.id !== playerId) throw new Error("Out of turn");
    if (type === "roll") {
      if (state.phase !== "rolling") throw new Error("Already rolled");
      return roll(state, ctx, state.remaining || 6);
    }
    if (type === "select") {
      if (state.phase !== "selecting") throw new Error("Nothing to select");
      const selected = Array.isArray(payload) ? (payload as number[]) : [];
      if (!selectionValid(state.dice, selected)) throw new Error("Selection must be a scoring set");
      const next = clone(state);
      next.selected = selected.slice().sort((a, b) => a - b);
      return next;
    }
    if (type === "keep") {
      if (state.phase !== "selecting") throw new Error("Nothing to keep");
      const selected =
        Array.isArray(payload) && (payload as number[]).length > 0
          ? (payload as number[])
          : state.selected;
      if (!selectionValid(state.dice, selected)) throw new Error("Selection must be a scoring set");
      const picked = selected.map((i) => state.dice[i]!);
      const gained = scoreDice(picked).score;
      const next = clone(state);
      next.turnScore += gained;
      const leftover = state.dice.filter((_, i) => !selected.includes(i));
      const hot = leftover.length === 0;
      next.dice = leftover;
      next.selected = [];
      next.remaining = hot ? 6 : leftover.length;
      next.phase = "rolling";
      const player = currentPlayer(next);
      push(next, `${player.name} kept ${picked.join("–")} for ${gained}. Turn ${next.turnScore}.`);
      if (hot) push(next, `${player.name} has hot dice and must roll all six.`);
      return next;
    }
    if (type === "bank") {
      if (state.phase !== "selecting") throw new Error("Bank after a scoring keep");
      let working = state;
      const incoming = Array.isArray(payload) ? (payload as number[]) : state.selected;
      if (incoming.length > 0) {
        working = await farkleEngine.apply(state, playerId, "keep", incoming, ctx);
      }
      if (working.remaining === 6 && working.dice.length === 0 && working.turnScore > 0) {
        throw new Error("Hot dice must be rerolled");
      }
      if (working.turnScore <= 0) throw new Error("Nothing to bank");
      const player = currentPlayer(working);
      if (!player.hasOpened && working.turnScore < FARKLE_OPENING_MINIMUM) {
        throw new Error("Need 500 in one turn to open");
      }
      const next = clone(working);
      const seat = next.players[next.current]!;
      seat.banked += next.turnScore;
      seat.hasOpened = true;
      push(next, `${seat.name} banks ${next.turnScore} (total ${seat.banked}).`);
      next.turnScore = 0;
      next.dice = [];
      next.selected = [];
      next.remaining = 6;
      next.rollsThisTurn = 0;
      next.phase = "rolling";
      if (seat.banked >= FARKLE_GOAL) return maybeComplete(next);
      next.current = nextSeat(next.players, next.current);
      return next;
    }
    throw new Error("Unknown action");
  },
  legalActions(state, playerId) {
    const actions: LegalAction[] = [];
    if (state.phase === "complete") return actions;
    if (currentPlayer(state).id !== playerId) return actions;
    if (state.phase === "rolling") {
      actions.push({ type: "roll", label: state.rollsThisTurn === 0 ? "Roll" : "Roll remaining" });
    }
    if (state.phase === "selecting") {
      const scored = scoreDice(state.dice);
      const allIdx = state.dice.map((_, i) => i).filter((i) => scored.used[i]);
      actions.push({ type: "keep", label: "Keep scoring dice", payload: allIdx });
      const player = currentPlayer(state);
      const projected = state.turnScore + scored.score;
      const hot = isHotDice(state.dice);
      if (!hot) {
        const opened = player.hasOpened || projected >= FARKLE_OPENING_MINIMUM;
        actions.push({
          type: "bank",
          label: opened ? "Bank" : "Need 500 to open",
          payload: allIdx,
          disabledReason: opened ? undefined : "Need 500 in one turn to open",
        });
      }
    }
    return actions.filter((a) => !a.disabledReason);
  },
  isTerminal(state) {
    return state.phase === "complete";
  },
  scores(state) {
    return Object.fromEntries(state.players.map((p) => [p.id, p.banked]));
  },
  project(state, playerId): GameView {
    const me = currentPlayer(state);
    const legal = farkleEngine.legalActions(state, playerId);
    const scored = state.dice.length ? scoreDice(state.dice) : null;
    return {
      gameId: "farkle",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : me.id,
      prompt:
        state.phase === "complete"
          ? `${state.players.find((p) => p.id === state.winnerId)?.name ?? "Winner"} takes the table.`
          : state.phase === "rolling"
            ? `${me.name} to roll ${state.remaining} dice.`
            : `${me.name} to keep scoring dice.`,
      scores: farkleEngine.scores(state),
      legal,
      terminal: state.phase === "complete",
      winnerId: state.winnerId,
      dice: state.dice,
      selected: state.selected,
      remainingDice: state.remaining,
      turnScore: state.turnScore,
      banked: Object.fromEntries(state.players.map((p) => [p.id, p.banked])),
      flags: {
        lastFarkle: Boolean(state.lastFarkle),
        hot: Boolean(scored && scored.usedCount === state.dice.length && scored.score > 0),
        opening: FARKLE_OPENING_MINIMUM,
      },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function farkleBotAction(state: FarkleState): { type: string; payload?: number[] } {
  if (state.phase === "rolling") return { type: "roll" };
  const scored = scoreDice(state.dice);
  const keep = state.dice.map((_, i) => i).filter((i) => scored.used[i]);
  const leftover = state.dice.length - scored.usedCount;
  const projected = state.turnScore + scored.score;
  const player = currentPlayer(state);
  const hot = leftover === 0;
  const canOpen = player.hasOpened || projected >= FARKLE_OPENING_MINIMUM;
  if (!hot && canOpen && (leftover <= 2 || projected >= 500)) {
    return { type: "bank", payload: keep };
  }
  return { type: "keep", payload: keep };
}
