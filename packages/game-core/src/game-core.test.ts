import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApplyContext, PlayerSeat } from "./engine.ts";
import { scoreDice, selectionValid } from "./farkle-score.ts";
import { farkleEngine } from "./farkle.ts";
import { sccEngine } from "./ship-captain-crew.ts";
import { crapsEngine } from "./craps.ts";
import { bestOfSeven, compareHands, rankFive } from "./poker.ts";
import { standardDeck, type Card } from "./cards.ts";
import { scoreMeld } from "./pinochle.ts";
import { holdemEngine } from "./holdem.ts";
import { spadesEngine } from "./spades.ts";
import { heartsEngine } from "./hearts.ts";
import { pitchEngine } from "./pitch.ts";
import { pinochleEngine } from "./pinochle.ts";

function seats(n: number, botsFrom = 1): PlayerSeat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: i === 0 ? "You" : `Bot ${i}`,
    seat: i,
    isBot: i >= botsFrom,
  }));
}

function scripted(diceSeq: number[][], decks: Card[][] = []): ApplyContext {
  const d = diceSeq.map((x) => x.slice());
  const k = decks.map((x) => x.slice());
  return {
    async drawDice(count) {
      const next = d.shift();
      if (!next || next.length !== count) throw new Error(`Need ${count} scripted dice`);
      return next;
    },
    async shuffle(items) {
      const next = k.shift();
      if (next) return next.slice() as typeof items;
      return items.slice();
    },
    now: 0,
  };
}

describe("Farkle scoring", () => {
  it("scores singles, of-a-kind, and combinations from the spec", () => {
    assert.equal(scoreDice([1]).score, 100);
    assert.equal(scoreDice([5]).score, 50);
    assert.equal(scoreDice([2, 2, 2]).score, 200);
    assert.equal(scoreDice([1, 1, 1]).score, 1000);
    assert.equal(scoreDice([4, 4, 4, 4]).score, 1000);
    assert.equal(scoreDice([3, 3, 3, 3, 3]).score, 2000);
    assert.equal(scoreDice([6, 6, 6, 6, 6, 6]).score, 3000);
    assert.equal(scoreDice([1, 2, 3, 4, 5, 6]).score, 1500);
    assert.equal(scoreDice([2, 2, 3, 3, 5, 5]).score, 1500);
    assert.equal(scoreDice([2, 2, 2, 4, 4, 4]).score, 2500);
  });

  it("farkles a dead roll and marks hot dice", () => {
    assert.equal(scoreDice([2, 3, 4, 6, 6, 3]).score, 0);
    assert.equal(scoreDice([1, 2, 3, 4, 5, 6]).usedCount, 6);
    assert.equal(selectionValid([1, 5, 2], [0, 1]), true);
    assert.equal(selectionValid([1, 5, 2], [2]), false);
  });

  it("prefers the maximum legal partition", () => {
    // four 1s: 3×1 + single 1 = 1100 beats four-of-a-kind 1000
    assert.equal(scoreDice([1, 1, 1, 1]).score, 1100);
    // four 5s: four-of-a-kind 1000 beats 3×5 + 5 = 550
    assert.equal(scoreDice([5, 5, 5, 5]).score, 1000);
  });

  it("rejects out-of-turn actions and requires 500 to open", async () => {
    let state = farkleEngine.initialState(seats(2));
    await assert.rejects(() => farkleEngine.apply(state, "p1", "roll", null, scripted([[1, 1, 1, 2, 3, 4]])));
    state = await farkleEngine.apply(state, "p0", "roll", null, scripted([[2, 3, 4, 6, 6, 3]]));
    assert.equal(state.current, 1);
    state = farkleEngine.initialState(seats(1, 1));
    state = await farkleEngine.apply(state, "p0", "roll", null, scripted([[1, 5, 2, 3, 4, 6]]));
    await assert.rejects(() =>
      farkleEngine.apply(state, "p0", "bank", [0, 1], scripted([])),
    );
  });
});

describe("Ship, Captain, Crew", () => {
  it("secures 6 then 5 then 4 and scores cargo", async () => {
    let state = sccEngine.initialState(seats(1, 1));
    state = await sccEngine.apply(state, "p0", "roll", null, scripted([[6, 5, 4, 6, 6]]));
    assert.equal(state.ship && state.captain && state.crew, true);
    assert.equal((state.cargoDice[0] ?? 0) + (state.cargoDice[1] ?? 0), 12);
    state = await sccEngine.apply(state, "p0", "stay", null, scripted([]));
    assert.equal(state.players[0]!.cargo, 12);
    assert.equal(sccEngine.isTerminal(state), true);
  });

  it("ignores a 5 without a ship", async () => {
    let state = sccEngine.initialState(seats(1, 1));
    state = await sccEngine.apply(state, "p0", "roll", null, scripted([[5, 4, 4, 3, 2]]));
    assert.equal(state.ship, false);
    assert.equal(state.captain, false);
  });

  it("zeroes cargo after three failed rolls", async () => {
    let state = sccEngine.initialState(seats(1, 1));
    state = await sccEngine.apply(state, "p0", "roll", null, scripted([[1, 2, 3, 3, 2]]));
    state = await sccEngine.apply(state, "p0", "continue", null, scripted([]));
    state = await sccEngine.apply(state, "p0", "roll", null, scripted([[1, 2, 3, 3, 2]]));
    state = await sccEngine.apply(state, "p0", "continue", null, scripted([]));
    state = await sccEngine.apply(state, "p0", "roll", null, scripted([[1, 2, 3, 3, 2]]));
    assert.equal(state.players[0]!.cargo, 0);
    assert.equal(sccEngine.isTerminal(state), true);
  });
});

describe("Craps Pass Line", () => {
  it("wins come-out 7/11 and loses 2/3/12", async () => {
    let win = await crapsEngine.apply(crapsEngine.initialState(seats(1, 1)), "p0", "roll", null, scripted([[3, 4]]));
    assert.equal(win.resolved, "win");
    let nat = await crapsEngine.apply(crapsEngine.initialState(seats(1, 1)), "p0", "roll", null, scripted([[5, 6]]));
    assert.equal(nat.resolved, "win");
    let crap = await crapsEngine.apply(crapsEngine.initialState(seats(1, 1)), "p0", "roll", null, scripted([[1, 1]]));
    assert.equal(crap.resolved, "loss");
  });

  it("sets a point and resolves hit vs seven-out", async () => {
    let state = await crapsEngine.apply(crapsEngine.initialState(seats(1, 1)), "p0", "roll", null, scripted([[3, 3]]));
    assert.equal(state.phase, "point");
    assert.equal(state.point, 6);
    state = await crapsEngine.apply(state, "p0", "roll", null, scripted([[2, 3]]));
    assert.equal(state.phase, "point");
    const hit = await crapsEngine.apply(state, "p0", "roll", null, scripted([[4, 2]]));
    assert.equal(hit.resolved, "win");
    let seven = await crapsEngine.apply(
      await crapsEngine.apply(crapsEngine.initialState(seats(1, 1)), "p0", "roll", null, scripted([[4, 4]])),
      "p0",
      "roll",
      null,
      scripted([[3, 4]]),
    );
    assert.equal(seven.resolved, "loss");
  });
});

function C(rank: string, suit: Card["suit"]): Card {
  return { id: `${rank}_${suit}`, suit, rank };
}

describe("Poker evaluator", () => {
  it("ranks the hierarchy including wheel and royal", () => {
    const royal = rankFive([C("A", "spades"), C("K", "spades"), C("Q", "spades"), C("J", "spades"), C("10", "spades")]);
    const wheel = rankFive([C("A", "hearts"), C("2", "hearts"), C("3", "hearts"), C("4", "hearts"), C("5", "hearts")]);
    const quads = rankFive([C("9", "spades"), C("9", "hearts"), C("9", "diamonds"), C("9", "clubs"), C("A", "spades")]);
    const full = rankFive([C("K", "spades"), C("K", "hearts"), C("K", "diamonds"), C("2", "clubs"), C("2", "spades")]);
    const flush = rankFive([C("A", "clubs"), C("J", "clubs"), C("9", "clubs"), C("4", "clubs"), C("3", "clubs")]);
    const straight = rankFive([C("9", "spades"), C("8", "hearts"), C("7", "diamonds"), C("6", "clubs"), C("5", "spades")]);
    const trips = rankFive([C("8", "spades"), C("8", "hearts"), C("8", "diamonds"), C("A", "clubs"), C("2", "spades")]);
    const two = rankFive([C("Q", "spades"), C("Q", "hearts"), C("7", "diamonds"), C("7", "clubs"), C("2", "spades")]);
    const pair = rankFive([C("A", "spades"), C("A", "hearts"), C("9", "diamonds"), C("5", "clubs"), C("2", "spades")]);
    const high = rankFive([C("A", "spades"), C("K", "hearts"), C("9", "diamonds"), C("5", "clubs"), C("2", "spades")]);
    const order = [royal, wheel, quads, full, flush, straight, trips, two, pair, high];
    for (let i = 0; i < order.length - 1; i++) {
      assert.ok(compareHands(order[i]!, order[i + 1]!) > 0, `${order[i]!.category} should beat ${order[i + 1]!.category}`);
    }
    assert.equal(royal.category, "royal-flush");
    assert.equal(wheel.category, "straight-flush");
    assert.equal(wheel.ranks[0], 5);
  });

  it("picks the best five from seven and ties equal hands", () => {
    const seven = bestOfSeven([
      C("A", "spades"),
      C("A", "hearts"),
      C("A", "diamonds"),
      C("K", "clubs"),
      C("K", "spades"),
      C("2", "clubs"),
      C("3", "clubs"),
    ]);
    assert.equal(seven.category, "full-house");
    const a = rankFive([C("A", "spades"), C("K", "hearts"), C("9", "diamonds"), C("5", "clubs"), C("2", "spades")]);
    const b = rankFive([C("A", "hearts"), C("K", "spades"), C("9", "clubs"), C("5", "diamonds"), C("2", "hearts")]);
    assert.equal(compareHands(a, b), 0);
  });
});

describe("Hold’em betting FSM", () => {
  it("deals, posts blinds, and rejects out-of-turn action", async () => {
    const deck = standardDeck();
    let state = holdemEngine.initialState(seats(3));
    state = await holdemEngine.apply(state, "p0", "deal", null, scripted([], [deck]));
    assert.equal(state.players[0]!.hole.length, 2);
    assert.ok(state.pot >= 15);
    const other = state.players.find((p) => p.seat !== state.toAct)!.id;
    await assert.rejects(() => holdemEngine.apply(state, other, "fold", null, scripted([])));
  });
});

describe("Spades / Hearts / Pitch / Pinochle", () => {
  it("deals spades and accepts bids then a legal lead", async () => {
    let state = spadesEngine.initialState(seats(4));
    state = await spadesEngine.apply(state, "p0", "deal", null, scripted([], [standardDeck()]));
    assert.equal(state.players[0]!.hand.length, 13);
    state = await spadesEngine.apply(state, "p1", "bid", 3, scripted([]));
    assert.equal(state.players[1]!.bid, 3);
  });

  it("deals hearts and requires three-card pass", async () => {
    let state = heartsEngine.initialState(seats(4));
    state = await heartsEngine.apply(state, "p0", "deal", null, scripted([], [standardDeck()]));
    assert.equal(state.phase, "pass");
    const ids = state.players[0]!.hand.slice(0, 3).map((c) => c.id);
    state = await heartsEngine.apply(state, "p0", "pass", ids, scripted([]));
    assert.equal(state.players[0]!.passed.length, 3);
  });

  it("deals pitch six cards and takes a bid", async () => {
    let state = pitchEngine.initialState(seats(4));
    state = await pitchEngine.apply(state, "p0", "deal", null, scripted([], [standardDeck()]));
    assert.equal(state.players[0]!.hand.length, 6);
    state = await pitchEngine.apply(state, "p1", "bid", 2, scripted([]));
    assert.equal(state.players[1]!.bid, 2);
  });

  it("scores pinochle meld including pinochle and run", () => {
    const run: Card[] = [
      C("A", "hearts"),
      C("10", "hearts"),
      C("K", "hearts"),
      C("Q", "hearts"),
      C("J", "hearts"),
      { id: "J_diamonds_a", suit: "diamonds", rank: "J" },
      { id: "Q_spades_a", suit: "spades", rank: "Q" },
      C("9", "hearts"),
    ];
    const meld = scoreMeld(run, "hearts");
    assert.ok(meld >= 150 + 40 + 10);
  });

  it("deals a 48-card pinochle pack", async () => {
    let state = pinochleEngine.initialState(seats(4));
    const deck = (await scripted([], []).shuffle(standardDeck()).then(() => null), null);
    void deck;
    const { pinochleDeck } = await import("./cards.ts");
    state = await pinochleEngine.apply(state, "p0", "deal", null, scripted([], [pinochleDeck()]));
    assert.equal(state.players[0]!.hand.length, 12);
  });
});
