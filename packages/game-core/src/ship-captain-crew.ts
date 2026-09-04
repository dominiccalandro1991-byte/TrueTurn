import type { ApplyContext, GameEngine, GameView, LegalAction, PlayerSeat } from "./engine.ts";
import { clone, nextSeat } from "./engine.ts";

export interface SccPlayer {
  id: string;
  name: string;
  seat: number;
  isBot: boolean;
  cargo: number | null;
}

export interface SccState {
  gameId: "ship-captain-crew";
  players: SccPlayer[];
  current: number;
  round: number;
  maxRounds: number;
  rollsLeft: number;
  dice: number[];
  ship: boolean;
  captain: boolean;
  crew: boolean;
  cargoDice: number[];
  phase: "rolling" | "deciding" | "complete";
  eventLog: string[];
  winnerId?: string;
}

function currentPlayer(state: SccState): SccPlayer {
  return state.players[state.current]!;
}

function push(state: SccState, msg: string) {
  state.eventLog = [...state.eventLog.slice(-24), msg];
}

function resolveHold(dice: number[], have: { ship: boolean; captain: boolean; crew: boolean }) {
  const pool = dice.slice();
  let ship = have.ship;
  let captain = have.captain;
  let crew = have.crew;
  const take = (face: number) => {
    const idx = pool.indexOf(face);
    if (idx >= 0) {
      pool.splice(idx, 1);
      return true;
    }
    return false;
  };
  if (!ship && take(6)) ship = true;
  if (ship && !captain && take(5)) captain = true;
  if (ship && captain && !crew && take(4)) crew = true;
  return { ship, captain, crew, rest: pool };
}

function cargoScore(state: SccState): number {
  if (!(state.ship && state.captain && state.crew)) return 0;
  if (state.cargoDice.length === 2) return state.cargoDice[0]! + state.cargoDice[1]!;
  return 0;
}

function finishTurn(state: SccState): SccState {
  const next = clone(state);
  const player = currentPlayer(next);
  const cargo = cargoScore(next);
  player.cargo = cargo;
  push(next, `${player.name} banks cargo ${cargo}.`);
  const everyoneDone = next.players.every((p) => p.cargo !== null);
  if (everyoneDone) {
    next.phase = "complete";
    const ranked = [...next.players].sort((a, b) => (b.cargo ?? 0) - (a.cargo ?? 0));
    next.winnerId = ranked[0]?.id;
    push(next, `${ranked[0]?.name ?? "Winner"} takes the cargo.`);
    return next;
  }
  next.current = nextSeat(next.players, next.current);
  next.rollsLeft = 3;
  next.dice = [];
  next.ship = false;
  next.captain = false;
  next.crew = false;
  next.cargoDice = [];
  next.phase = "rolling";
  return next;
}

export const sccEngine: GameEngine<SccState> = {
  id: "ship-captain-crew",
  initialState(players: PlayerSeat[]) {
    return {
      gameId: "ship-captain-crew",
      players: players.map((p) => ({ ...p, cargo: null })),
      current: 0,
      round: 1,
      maxRounds: 1,
      rollsLeft: 3,
      dice: [],
      ship: false,
      captain: false,
      crew: false,
      cargoDice: [],
      phase: "rolling",
      eventLog: ["Secure 6, then 5, then 4. Remaining two dice are cargo. Three rolls."],
    };
  },
  async apply(state, playerId, type, _payload, ctx) {
    if (state.phase === "complete") throw new Error("Match is complete");
    if (currentPlayer(state).id !== playerId) throw new Error("Out of turn");
    if (type === "roll") {
      if (state.rollsLeft <= 0) throw new Error("No rolls left");
      const next = clone(state);
      const held: number[] = [];
      if (next.ship) held.push(6);
      if (next.captain) held.push(5);
      if (next.crew) held.push(4);
      const rolling = 5 - held.length;
      const rolled = rolling > 0 ? await ctx.drawDice(rolling) : [];
      const resolved = resolveHold(rolled, {
        ship: next.ship,
        captain: next.captain,
        crew: next.crew,
      });
      next.ship = resolved.ship;
      next.captain = resolved.captain;
      next.crew = resolved.crew;
      next.rollsLeft -= 1;
      next.dice = [
        ...(next.ship ? [6] : []),
        ...(next.captain ? [5] : []),
        ...(next.crew ? [4] : []),
        ...resolved.rest,
      ];
      next.cargoDice = next.ship && next.captain && next.crew ? resolved.rest.slice(0, 2) : [];
      const player = currentPlayer(next);
      push(next, `${player.name} rolled ${rolled.join("–") || "held"}.`);
      if (next.rollsLeft === 0) return finishTurn(next);
      next.phase = "deciding";
      return next;
    }
    if (type === "stay") {
      if (state.phase !== "deciding") throw new Error("Roll first");
      return finishTurn(state);
    }
    if (type === "continue") {
      if (state.phase !== "deciding") throw new Error("Roll first");
      if (state.rollsLeft <= 0) throw new Error("No rolls left");
      const next = clone(state);
      next.phase = "rolling";
      return next;
    }
    throw new Error("Unknown action");
  },
  legalActions(state, playerId) {
    const actions: LegalAction[] = [];
    if (state.phase === "complete") return actions;
    if (currentPlayer(state).id !== playerId) return actions;
    if (state.phase === "rolling" && state.rollsLeft > 0) {
      actions.push({ type: "roll", label: `Roll (${state.rollsLeft} left)` });
    }
    if (state.phase === "deciding") {
      if (state.rollsLeft > 0) actions.push({ type: "continue", label: "Reroll unsecured" });
      actions.push({ type: "stay", label: "Bank cargo" });
    }
    return actions;
  },
  isTerminal(state) {
    return state.phase === "complete";
  },
  scores(state) {
    return Object.fromEntries(state.players.map((p) => [p.id, p.cargo ?? 0]));
  },
  project(state, playerId): GameView {
    const me = currentPlayer(state);
    return {
      gameId: "ship-captain-crew",
      phase: state.phase,
      toAct: state.phase === "complete" ? null : me.id,
      prompt:
        state.phase === "complete"
          ? "Cargo counted."
          : `${me.name}: ship ${state.ship ? "yes" : "no"} · captain ${state.captain ? "yes" : "no"} · crew ${state.crew ? "yes" : "no"}`,
      scores: sccEngine.scores(state),
      legal: sccEngine.legalActions(state, playerId),
      terminal: state.phase === "complete",
      winnerId: state.winnerId,
      dice: state.dice,
      flags: {
        ship: state.ship ? 1 : 0,
        captain: state.captain ? 1 : 0,
        crew: state.crew ? 1 : 0,
        cargo: cargoScore(state),
        rollsLeft: state.rollsLeft,
      },
      seats: state.players,
      eventLog: state.eventLog,
    };
  },
};

export function sccBotAction(state: SccState): { type: string } {
  if (state.phase === "rolling") return { type: "roll" };
  const cargo = cargoScore(state);
  if (state.ship && state.captain && state.crew && cargo >= 8) return { type: "stay" };
  if (state.rollsLeft > 0) return { type: "continue" };
  return { type: "stay" };
}
