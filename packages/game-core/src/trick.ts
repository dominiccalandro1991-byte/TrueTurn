import type { Card, Suit } from "./cards.ts";
import { pokerValue, PINOCHLE_RANK_VALUE } from "./cards.ts";

export function ledSuit(trick: { card: Card }[]): Suit | null {
  return trick[0]?.card.suit ?? null;
}

export function hasSuit(hand: Card[], suit: Suit): boolean {
  return hand.some((c) => c.suit === suit);
}

export function follows(card: Card, lead: Suit | null): boolean {
  if (!lead) return true;
  return card.suit === lead;
}

export function pokerBeats(a: Card, b: Card, lead: Suit, trump: Suit | null): boolean {
  const aTrump = trump !== null && a.suit === trump;
  const bTrump = trump !== null && b.suit === trump;
  if (aTrump !== bTrump) return aTrump;
  if (a.suit !== b.suit) {
    if (a.suit === lead && b.suit !== lead && !bTrump) return true;
    if (b.suit === lead && a.suit !== lead && !aTrump) return false;
    return false;
  }
  return pokerValue(a.rank) > pokerValue(b.rank);
}

export function pinochleBeats(a: Card, b: Card, lead: Suit, trump: Suit): boolean {
  const aTrump = a.suit === trump;
  const bTrump = b.suit === trump;
  if (aTrump !== bTrump) return aTrump;
  if (a.suit !== b.suit) return a.suit === lead && b.suit !== lead;
  return (PINOCHLE_RANK_VALUE[a.rank] ?? 0) > (PINOCHLE_RANK_VALUE[b.rank] ?? 0);
}

export function winnerIndex(
  trick: { seat: number; card: Card }[],
  trump: Suit | null,
  ranking: "poker" | "pinochle" = "poker",
): number {
  const lead = trick[0]!.card.suit;
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const beats =
      ranking === "pinochle"
        ? pinochleBeats(trick[i]!.card, trick[best]!.card, lead, trump ?? lead)
        : pokerBeats(trick[i]!.card, trick[best]!.card, lead, trump);
    if (beats) best = i;
  }
  return trick[best]!.seat;
}

export function legalFollow(hand: Card[], trick: { card: Card }[], trump: Suit | null): Card[] {
  if (trick.length === 0) return hand.slice();
  const lead = trick[0]!.card.suit;
  const follow = hand.filter((c) => c.suit === lead);
  if (follow.length) return follow;
  if (trump) {
    const trumps = hand.filter((c) => c.suit === trump);
    if (trumps.length) return trumps;
  }
  return hand.slice();
}

export function legalPinochle(
  hand: Card[],
  trick: { card: Card }[],
  trump: Suit,
): Card[] {
  if (trick.length === 0) return hand.slice();
  const lead = trick[0]!.card.suit;
  const currentBest = trick.reduce((best, play) => {
    return pinochleBeats(play.card, best, lead, trump) ? play.card : best;
  }, trick[0]!.card);
  const ofLead = hand.filter((c) => c.suit === lead);
  if (ofLead.length) {
    const beat = ofLead.filter((c) => pinochleBeats(c, currentBest, lead, trump));
    return beat.length ? beat : ofLead;
  }
  const trumps = hand.filter((c) => c.suit === trump);
  if (trumps.length) {
    const beat = trumps.filter((c) => pinochleBeats(c, currentBest, lead, trump));
    return beat.length ? beat : trumps;
  }
  return hand.slice();
}
