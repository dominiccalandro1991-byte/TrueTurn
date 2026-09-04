import { type Card, pokerValue, SUITS } from "./cards.ts";

export const POKER_CATEGORIES = [
  "high-card",
  "pair",
  "two-pair",
  "three-of-a-kind",
  "straight",
  "flush",
  "full-house",
  "four-of-a-kind",
  "straight-flush",
  "royal-flush",
] as const;

export type PokerCategory = (typeof POKER_CATEGORIES)[number];

export interface PokerHandRank {
  category: PokerCategory;
  categoryIndex: number;
  ranks: number[];
  cards: Card[];
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0]?.suit);
}

function uniqueSortedValues(cards: Card[]): number[] {
  return [...new Set(cards.map((c) => pokerValue(c.rank)))].sort((a, b) => b - a);
}

function straightHigh(values: number[]): number | null {
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.includes(14)) uniq.unshift(1);
  let run = 1;
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] === uniq[i - 1]! + 1) {
      run += 1;
      if (run >= 5) return uniq[i] === 1 ? 5 : uniq[i]!;
    } else if (uniq[i] !== uniq[i - 1]) {
      run = 1;
    }
  }
  return null;
}

function countByRank(cards: Card[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const c of cards) {
    const v = pokerValue(c.rank);
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
}

export function rankFive(cards: Card[]): PokerHandRank {
  if (cards.length !== 5) throw new Error("Need five cards");
  const values = cards.map((c) => pokerValue(c.rank));
  const flush = isFlush(cards);
  const sHigh = straightHigh(values);
  const counts = [...countByRank(cards).entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranksDesc = uniqueSortedValues(cards);

  if (flush && sHigh === 14) {
    return { category: "royal-flush", categoryIndex: 9, ranks: [14], cards };
  }
  if (flush && sHigh) {
    return { category: "straight-flush", categoryIndex: 8, ranks: [sHigh], cards };
  }
  if (counts[0]?.[1] === 4) {
    const four = counts[0][0];
    const kicker = counts.find((c) => c[0] !== four)?.[0] ?? 0;
    return { category: "four-of-a-kind", categoryIndex: 7, ranks: [four, kicker], cards };
  }
  if (counts[0]?.[1] === 3 && counts[1]?.[1] === 2) {
    return { category: "full-house", categoryIndex: 6, ranks: [counts[0][0], counts[1][0]], cards };
  }
  if (flush) {
    return { category: "flush", categoryIndex: 5, ranks: ranksDesc, cards };
  }
  if (sHigh) {
    return { category: "straight", categoryIndex: 4, ranks: [sHigh], cards };
  }
  if (counts[0]?.[1] === 3) {
    const trips = counts[0][0];
    const kickers = ranksDesc.filter((r) => r !== trips);
    return { category: "three-of-a-kind", categoryIndex: 3, ranks: [trips, ...kickers], cards };
  }
  if (counts[0]?.[1] === 2 && counts[1]?.[1] === 2) {
    const a = Math.max(counts[0][0], counts[1][0]);
    const b = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts.find((c) => c[1] === 1)?.[0] ?? 0;
    return { category: "two-pair", categoryIndex: 2, ranks: [a, b, kicker], cards };
  }
  if (counts[0]?.[1] === 2) {
    const pair = counts[0][0];
    const kickers = ranksDesc.filter((r) => r !== pair);
    return { category: "pair", categoryIndex: 1, ranks: [pair, ...kickers], cards };
  }
  return { category: "high-card", categoryIndex: 0, ranks: ranksDesc, cards };
}

export function compareHands(a: PokerHandRank, b: PokerHandRank): number {
  if (a.categoryIndex !== b.categoryIndex) return a.categoryIndex - b.categoryIndex;
  const n = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < n; i++) {
    const av = a.ranks[i] ?? 0;
    const bv = b.ranks[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function bestOfSeven(cards: Card[]): PokerHandRank {
  if (cards.length < 5) throw new Error("Need at least five cards");
  if (cards.length === 5) return rankFive(cards);
  const fives = combinations(cards, 5);
  let best = rankFive(fives[0]!);
  for (let i = 1; i < fives.length; i++) {
    const ranked = rankFive(fives[i]!);
    if (compareHands(ranked, best) > 0) best = ranked;
  }
  return best;
}

export function categoryLabel(category: PokerCategory): string {
  return category.replace(/-/g, " ");
}

export { SUITS };
