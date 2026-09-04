export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS_52 = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export type Rank52 = (typeof RANKS_52)[number];

export const PINOCHLE_RANKS = ["A", "10", "K", "Q", "J", "9"] as const;
export type PinochleRank = (typeof PINOCHLE_RANKS)[number];

export interface Card {
  id: string;
  suit: Suit;
  rank: string;
}

const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_GLYPH[card.suit]}`;
}

export function viewCard(card: Card): { id: string; suit: string; rank: string; label: string } {
  return { id: card.id, suit: card.suit, rank: card.rank, label: cardLabel(card) };
}

export function standardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS_52) {
      deck.push({ id: `${rank}_${suit}`, suit, rank });
    }
  }
  return deck;
}

export function pinochleDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of PINOCHLE_RANKS) {
      deck.push({ id: `${rank}_${suit}_a`, suit, rank });
      deck.push({ id: `${rank}_${suit}_b`, suit, rank });
    }
  }
  return deck;
}

export const POKER_RANK_VALUE: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export const PINOCHLE_RANK_VALUE: Record<string, number> = {
  "9": 1,
  J: 2,
  Q: 3,
  K: 4,
  "10": 5,
  A: 6,
};

export function pokerValue(rank: string): number {
  return POKER_RANK_VALUE[rank] ?? 0;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.id === b.id;
}

export function byId(cards: Card[], id: string): Card | undefined {
  return cards.find((c) => c.id === id);
}

export function removeCard(cards: Card[], id: string): Card[] {
  return cards.filter((c) => c.id !== id);
}

export const PITCH_GAME_VALUE: Record<string, number> = {
  "10": 10,
  A: 4,
  K: 3,
  Q: 2,
  J: 1,
};

export const PINOCHLE_TRICK_VALUE: Record<string, number> = {
  A: 11,
  "10": 10,
  K: 4,
  Q: 3,
  J: 2,
  "9": 0,
};
