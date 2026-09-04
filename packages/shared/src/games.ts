export const GAME_IDS = [
  "farkle",
  "ship-captain-crew",
  "craps",
  "holdem",
  "spades",
  "hearts",
  "pitch",
  "pinochle",
] as const;

export type GameId = (typeof GAME_IDS)[number];

export const GAME_CATALOG: Record<
  GameId,
  {
    title: string;
    family: "dice" | "cards";
    blurb: string;
    seats: { min: number; max: number; default: number };
    anteTokens: number;
    objective: string;
  }
> = {
  farkle: {
    title: "10,000",
    family: "dice",
    blurb: "Six dice. Bank 10,000 before the table does. Farkle and the turn burns.",
    seats: { min: 1, max: 4, default: 2 },
    anteTokens: 10,
    objective: "First to 10,000 banked points",
  },
  "ship-captain-crew": {
    title: "Ship, Captain, Crew",
    family: "dice",
    blurb: "Lock 6, then 5, then 4. The last two dice are cargo.",
    seats: { min: 1, max: 4, default: 2 },
    anteTokens: 10,
    objective: "Highest cargo after equal turns",
  },
  craps: {
    title: "Craps",
    family: "dice",
    blurb: "Pass Line only. Come-out, point, seven-out. The house is the table.",
    seats: { min: 1, max: 1, default: 1 },
    anteTokens: 20,
    objective: "Pass Line wins versus the house",
  },
  holdem: {
    title: "Texas Hold’em",
    family: "cards",
    blurb: "Two hole cards. Five community. Best five-card hand takes the pot.",
    seats: { min: 2, max: 6, default: 4 },
    anteTokens: 0,
    objective: "Win chips with the best hand or by folding the field",
  },
  spades: {
    title: "Spades",
    family: "cards",
    blurb: "Partners. Bid your tricks. Bags sting. Nil is a high-wire act.",
    seats: { min: 4, max: 4, default: 4 },
    anteTokens: 10,
    objective: "First team to 500",
  },
  hearts: {
    title: "Hearts",
    family: "cards",
    blurb: "Duck hearts and the queen. Or shoot the moon.",
    seats: { min: 4, max: 4, default: 4 },
    anteTokens: 10,
    objective: "Lowest score; hand ends at 100",
  },
  pitch: {
    title: "Pitch",
    family: "cards",
    blurb: "High, Low, Jack, Game. Bid it, make it, or get set.",
    seats: { min: 4, max: 4, default: 4 },
    anteTokens: 10,
    objective: "First team to 11",
  },
  pinochle: {
    title: "Pinochle",
    family: "cards",
    blurb: "Single-deck classic. Meld, then take tricks. Must beat when you can.",
    seats: { min: 4, max: 4, default: 4 },
    anteTokens: 10,
    objective: "Highest combined meld + trick points this deal (demo hand)",
  },
};

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}
