import type { GameId } from "../../shared/src/games.ts";
import type { ActionPayload, GameEngine } from "./engine.ts";
import { crapsEngine } from "./craps.ts";
import { farkleBotAction, farkleEngine, type FarkleState } from "./farkle.ts";
import { heartsBotAction, heartsEngine, type HeartsState } from "./hearts.ts";
import { holdemBotAction, holdemEngine, type HoldemState } from "./holdem.ts";
import { pinochleBotAction, pinochleEngine, type PinochleState } from "./pinochle.ts";
import { pitchBotAction, pitchEngine, type PitchState } from "./pitch.ts";
import { sccBotAction, sccEngine, type SccState } from "./ship-captain-crew.ts";
import { spadesBotAction, spadesEngine, type SpadesState } from "./spades.ts";

export type AnyState =
  | FarkleState
  | SccState
  | ReturnType<typeof crapsEngine.initialState>
  | HoldemState
  | SpadesState
  | HeartsState
  | PitchState
  | PinochleState;

export const engines: Record<GameId, GameEngine<AnyState>> = {
  farkle: farkleEngine as GameEngine<AnyState>,
  "ship-captain-crew": sccEngine as GameEngine<AnyState>,
  craps: crapsEngine as GameEngine<AnyState>,
  holdem: holdemEngine as GameEngine<AnyState>,
  spades: spadesEngine as GameEngine<AnyState>,
  hearts: heartsEngine as GameEngine<AnyState>,
  pitch: pitchEngine as GameEngine<AnyState>,
  pinochle: pinochleEngine as GameEngine<AnyState>,
};

export function botAction(state: AnyState): { type: string; payload?: ActionPayload } {
  switch (state.gameId) {
    case "farkle":
      return farkleBotAction(state);
    case "ship-captain-crew":
      return sccBotAction(state);
    case "craps":
      return { type: "roll" };
    case "holdem":
      return holdemBotAction(state);
    case "spades":
      return spadesBotAction(state);
    case "hearts":
      return heartsBotAction(state);
    case "pitch":
      return pitchBotAction(state);
    case "pinochle":
      return pinochleBotAction(state);
    default:
      return { type: "roll" };
  }
}
