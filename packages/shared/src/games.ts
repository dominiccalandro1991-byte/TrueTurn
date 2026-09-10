export const GAME_IDS = [
  "farkle",
  "ship-captain-crew",
  "craps",
  "yahtzee",
  "liar-dice",
  "holdem",
  "five-card-draw",
  "gin-rummy",
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
  yahtzee: {
    title: "Yahtzee",
    family: "dice",
    blurb: "Five dice. Thirteen boxes. Bonus at 63 upper.",
    seats: { min: 1, max: 4, default: 2 },
    anteTokens: 10,
    objective: "Highest card after 13 boxes",
  },
  "liar-dice": {
    title: "Liar’s Dice",
    family: "dice",
    blurb: "Hidden cups. Bid the table. Call the lie.",
    seats: { min: 2, max: 6, default: 4 },
    anteTokens: 10,
    objective: "Last player with dice",
  },
  holdem: {
    title: "Texas Hold’em",
    family: "cards",
    blurb: "Two hole cards. Five community. Best five-card hand takes the pot.",
    seats: { min: 2, max: 6, default: 4 },
    anteTokens: 0,
    objective: "Win chips with the best hand or by folding the field",
  },
  "five-card-draw": {
    title: "Five-Card Draw",
    family: "cards",
    blurb: "Five in the hole. Bet, throw, bet, show.",
    seats: { min: 2, max: 5, default: 4 },
    anteTokens: 0,
    objective: "Take the pot with the best five",
  },
  "gin-rummy": {
    title: "Gin Rummy",
    family: "cards",
    blurb: "Ten cards. Meld runs and sets. Knock at 10. Gin is clean.",
    seats: { min: 2, max: 2, default: 2 },
    anteTokens: 10,
    objective: "Knock or gin before the stock dies",
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
