import type { GameId } from "../../shared/src/games.ts";

export interface PlayerSeat {
  id: string;
  name: string;
  seat: number;
  isBot: boolean;
}

export interface ApplyContext {
  drawDice: (count: number) => Promise<number[]>;
  shuffle: <T>(items: T[]) => Promise<T[]>;
  now: number;
}

export type ActionPayload =
  | string
  | number
  | number[]
  | string[]
  | { amount: number }
  | { qty: number; face: number }
  | { category: string }
  | null;

export interface LegalAction {
  type: string;
  label: string;
  payload?: ActionPayload;
  disabledReason?: string;
}

export interface GameView {
  gameId: GameId;
  phase: string;
  toAct: string | null;
  prompt: string;
  scores: Record<string, number>;
  legal: LegalAction[];
  terminal: boolean;
  winnerId?: string;
  winnerIds?: string[];
  dice?: number[];
  selected?: number[];
  remainingDice?: number;
  turnScore?: number;
  banked?: Record<string, number>;
  flags?: Record<string, boolean | number | string>;
  seats: PlayerSeat[];
  myHand?: { id: string; suit: string; rank: string; label: string }[];
  hiddenCounts?: Record<string, number>;
  community?: { id: string; suit: string; rank: string; label: string }[];
  trick?: { seat: number; card: { id: string; suit: string; rank: string; label: string } }[];
  pot?: number;
  eventLog: string[];
}

export interface GameEngine<TState> {
  id: GameId;
  initialState: (players: PlayerSeat[], seedKey?: string) => TState;
  apply: (
    state: TState,
    playerId: string,
    type: string,
    payload: ActionPayload | undefined,
    ctx: ApplyContext,
  ) => Promise<TState>;
  legalActions: (state: TState, playerId: string) => LegalAction[];
  isTerminal: (state: TState) => boolean;
  scores: (state: TState) => Record<string, number>;
  project: (state: TState, playerId: string) => GameView;
}

export function assertSeat(players: PlayerSeat[], playerId: string): PlayerSeat {
  const seat = players.find((p) => p.id === playerId);
  if (!seat) throw new Error("Player is not seated");
  return seat;
}

export function nextSeat(players: PlayerSeat[], current: number): number {
  return (current + 1) % players.length;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
