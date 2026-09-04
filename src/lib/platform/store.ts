import { Ledger } from "../../../packages/game-core/src/ledger.ts";
import type { MatchRecord } from "../../../packages/game-core/src/match.ts";

interface PlatformMemory {
  matches: Map<string, MatchRecord>;
  ledger: Ledger;
  avatarJobs: Map<string, { status: "queued" | "ready" | "failed"; meshId: string | null }>;
  presence: Map<string, number>;
}

const g = globalThis as unknown as { __trueturn?: PlatformMemory };

export function memory(): PlatformMemory {
  if (!g.__trueturn) {
    g.__trueturn = {
      matches: new Map(),
      ledger: new Ledger(),
      avatarJobs: new Map(),
      presence: new Map(),
    };
  }
  if (!g.__trueturn.presence) g.__trueturn.presence = new Map();
  return g.__trueturn;
}

export function touchPresence(playerId: string, now = Date.now()): void {
  memory().presence.set(playerId, now);
}

export function playersOnline(now = Date.now()): number {
  let n = 0;
  for (const ts of memory().presence.values()) {
    if (now - ts < 60_000) n += 1;
  }
  return n;
}

export function findMatch(idOrCode: string): MatchRecord | undefined {
  const mem = memory();
  const direct = mem.matches.get(idOrCode);
  if (direct) return direct;
  const code = idOrCode.trim().toUpperCase();
  for (const match of mem.matches.values()) {
    if (match.code === code) return match;
  }
  return undefined;
}
