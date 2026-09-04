import { Ledger } from "../../../packages/game-core/src/ledger.ts";
import type { MatchRecord } from "../../../packages/game-core/src/match.ts";

interface PlatformMemory {
  matches: Map<string, MatchRecord>;
  ledger: Ledger;
  avatarJobs: Map<string, { status: "queued" | "ready" | "failed"; meshId: string | null }>;
}

const g = globalThis as unknown as { __trueturn?: PlatformMemory };

export function memory(): PlatformMemory {
  if (!g.__trueturn) {
    g.__trueturn = {
      matches: new Map(),
      ledger: new Ledger(),
      avatarJobs: new Map(),
    };
  }
  return g.__trueturn;
}
