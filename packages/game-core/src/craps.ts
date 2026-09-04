import type { ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone } from "./engine.ts";

export interface CrapsState {
  gameId: "craps";
  players: PlayerSeat[];
  phase: "come-out" | "point" | "complete";
  point: number | null;
  lastDice: number[];
  lastSum: number | null;
  wins: number;
  losses: number;
  streak: number;
  eventLog: string[];
  winnerId?: string;
  resolved?: "win" | "loss";
}

function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

export const crapsEngine: GameEngine<CrapsState> = {
  id: "craps",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "craps",
      players,
      phase: "come-out",
      point: null,
      lastDice: [],
      lastSum: null,
      wins: 0,
      losses: 0,
      streak: 0,
      eventLog: ["Pass Line. 7 or 11 win come-out. 2, 3, 12 lose. Otherwise the point is set."],
    };
  },
  async apply(state, playerId, type, _payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    if (state.players[0]?.id !== playerId) throw new Error("Out of turn");
    if (type !== "roll") throw new Error("Unknown action");
    const next = clone(state);
    const dice = await ctx.drawDice(2);
    const total = sum(dice);
    next.lastDice = dice;
    next.lastSum = total;
    const shooter = next.players[0]!;
    if (next.phase === "come-out") {
      if (total === 7 || total === 11) {
        next.wins += 1;
        next.streak = next.streak >= 0 ? next.streak + 1 : 1;
        next.resolved = "win";
        next.phase = "complete";
        next.winnerId = shooter.id;
        next.eventLog = [...next.eventLog, `Come-out ${dice.join("–")} = ${total}. Pass Line wins.`];
      } else if (total === 2 || total === 3 || total === 12) {
        next.losses += 1;
        next.streak = next.streak <= 0 ? next.streak - 1 : -1;
        next.resolved = "loss";
        next.phase = "complete";
        next.eventLog = [...next.eventLog, `Come-out ${dice.join("–")} = ${total}. Craps. Pass Line loses.`];
      } else {
        next.point = total;
        next.phase = "point";
        next.eventLog = [...next.eventLog, `Point is ${total}. Hit it before 7.`];
      }
      return next;
    }
    if (total === next.point) {
      next.wins += 1;
      next.resolved = "win";
      next.phase = "complete";
      next.winnerId = shooter.id;
      next.eventLog = [...next.eventLog, `${dice.join("–")} = ${total}. Point hit. Pass Line wins.`];
      return next;
    }
    if (total === 7) {
      next.losses += 1;
      next.resolved = "loss";
      next.phase = "complete";
      next.eventLog = [...next.eventLog, `${dice.join("–")} = 7. Seven-out. Pass Line loses.`];
      return next;
    }
    next.eventLog = [...next.eventLog, `${dice.join("–")} = ${total}. Point ${next.point} still live.`];
    return next;
  },
  legalActions(state, playerId) {
    if (state.phase === "complete") return [];
    if (state.players[0]?.id !== playerId) return [];
    const actions: LegalAction[] = [{ type: "roll", label: state.phase === "point" ? "Roll for point" : "Come-out roll" }];
    return actions;
  },
  isTerminal(state) {
    return state.phase === "complete";
  },
  scores(state) {
    const id = state.players[0]?.id ?? "shooter";
    return { [id]: state.resolved === "win" ? 1 : state.resolved === "loss" ? 0 : 0 };
  },
  project(state, playerId): GameView {
    const shooter = state.players[0]!;
    return {
      gameId: "craps",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : shooter.id,
      prompt:
        state.phase === "complete"
          ? state.resolved === "win"
            ? "Pass Line wins."
            : "Pass Line loses."
          : state.phase === "point"
            ? `Point ${state.point}. Roll it before 7.`
            : "Come-out roll.",
      scores: crapsEngine.scores(state),
      legal: crapsEngine.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerId: state.winnerId,
      dice: state.lastDice,
      flags: {
        point: state.point ?? 0,
        lastSum: state.lastSum ?? 0,
      },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};
