import { HmacStream } from "./stream.ts";

/** In-place Fisher–Yates using unbiased HMAC integers. */
export async function fisherYates<T>(items: T[], stream: HmacStream): Promise<T[]> {
  const deck = items.slice();
  for (let i = deck.length - 1; i >= 1; i--) {
    const j = await stream.nextIntInclusive(i);
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}
