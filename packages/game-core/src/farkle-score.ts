export interface ScoreBreakdown {
  score: number;
  usedCount: number;
  used: boolean[];
}

type Step =
  | { t: "straight" }
  | { t: "threePairs" }
  | { t: "twoTrips" }
  | { t: "kind"; face: number; n: number }
  | { t: "single"; face: 1 | 5 };

interface Result {
  score: number;
  used: number;
  steps: Step[];
}

function ofAKindPoints(face: number, count: number): number {
  if (count === 3) return face === 1 ? 1000 : face * 100;
  if (count === 4) return 1000;
  if (count === 5) return 2000;
  if (count === 6) return 3000;
  return 0;
}

function better(a: Result, b: Result): Result {
  if (b.score > a.score) return b;
  if (b.score === a.score && b.used > a.used) return b;
  return a;
}

function countsOf(dice: readonly number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]! += 1;
  return c;
}

const memo = new Map<string, Result>();

function keyOf(c: number[]): string {
  return c.slice(1).join(",");
}

function search(c: number[]): Result {
  const key = keyOf(c);
  const cached = memo.get(key);
  if (cached) return cached;
  const total = c[1]! + c[2]! + c[3]! + c[4]! + c[5]! + c[6]!;
  let best: Result = { score: 0, used: 0, steps: [] };

  const take = (pts: number, used: number, step: Step, rest: Result) => {
    best = better(best, {
      score: pts + rest.score,
      used: used + rest.used,
      steps: [step, ...rest.steps],
    });
  };

  if (total === 6) {
    if (c[1] === 1 && c[2] === 1 && c[3] === 1 && c[4] === 1 && c[5] === 1 && c[6] === 1) {
      take(1500, 6, { t: "straight" }, { score: 0, used: 0, steps: [] });
    }
    if ([1, 2, 3, 4, 5, 6].filter((f) => c[f] === 2).length === 3) {
      take(1500, 6, { t: "threePairs" }, { score: 0, used: 0, steps: [] });
    }
    if ([1, 2, 3, 4, 5, 6].filter((f) => c[f] === 3).length === 2) {
      take(2500, 6, { t: "twoTrips" }, { score: 0, used: 0, steps: [] });
    }
  }

  for (let face = 1; face <= 6; face++) {
    for (let n = 6; n >= 3; n--) {
      if (c[face]! >= n) {
        c[face]! -= n;
        take(ofAKindPoints(face, n), n, { t: "kind", face, n }, search(c));
        c[face]! += n;
      }
    }
  }
  if (c[1]! > 0) {
    c[1]!--;
    take(100, 1, { t: "single", face: 1 }, search(c));
    c[1]!++;
  }
  if (c[5]! > 0) {
    c[5]!--;
    take(50, 1, { t: "single", face: 5 }, search(c));
    c[5]!++;
  }

  memo.set(key, best);
  return best;
}

function applyUsed(dice: readonly number[], steps: Step[]): boolean[] {
  const leftover = countsOf(dice);
  const consume = (face: number, n: number) => {
    leftover[face]! -= n;
  };
  for (const step of steps) {
    if (step.t === "straight" || step.t === "threePairs" || step.t === "twoTrips") {
      return dice.map(() => true);
    }
    if (step.t === "kind") consume(step.face, step.n);
    if (step.t === "single") consume(step.face, 1);
  }
  return dice.map((face) => {
    if (leftover[face]! > 0) {
      leftover[face]!--;
      return false;
    }
    return true;
  });
}

export function scoreDice(dice: readonly number[]): ScoreBreakdown {
  if (dice.length === 0) return { score: 0, usedCount: 0, used: [] };
  memo.clear();
  const result = search(countsOf(dice));
  return {
    score: result.score,
    usedCount: result.used,
    used: applyUsed(dice, result.steps),
  };
}

export function isFarkle(dice: readonly number[]): boolean {
  return scoreDice(dice).score === 0;
}

export function isHotDice(dice: readonly number[]): boolean {
  const s = scoreDice(dice);
  return s.score > 0 && s.usedCount === dice.length;
}

export function selectionValid(dice: readonly number[], selected: number[]): boolean {
  if (selected.length === 0) return false;
  const uniq = new Set(selected);
  if (uniq.size !== selected.length) return false;
  if (selected.some((i) => i < 0 || i >= dice.length)) return false;
  const picked = selected.map((i) => dice[i]!);
  const scored = scoreDice(picked);
  return scored.score > 0 && scored.usedCount === picked.length;
}
