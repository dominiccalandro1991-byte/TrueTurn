import { STARTING_DIAMONDS, STARTING_TOKENS, TOKEN_BALANCE_CAP, TOKEN_DAILY_GRANT, TOKEN_TTL_MS } from "../../shared/src/constants.ts";
import { ERROR_CODES, PlatformError } from "../../shared/src/errors.ts";
import { createId } from "../../shared/src/ids.ts";

export type Currency = "tokens" | "diamonds";

export interface LedgerEntry {
  id: string;
  userId: string;
  matchId: string | null;
  reason: string;
  currency: Currency;
  amount: number;
  previousBalance: number;
  resultingBalance: number;
  idempotencyKey: string;
  ts: number;
}

export interface Wallet {
  userId: string;
  tokens: number;
  diamonds: number;
  lastTokenGrantAt: number;
}

export class Ledger {
  wallets = new Map<string, Wallet>();
  entries: LedgerEntry[] = [];
  seen = new Map<string, LedgerEntry>();

  wallet(userId: string, now = Date.now()): Wallet {
    let w = this.wallets.get(userId);
    if (!w) {
      w = {
        userId,
        tokens: STARTING_TOKENS,
        diamonds: STARTING_DIAMONDS,
        lastTokenGrantAt: now,
      };
      this.wallets.set(userId, w);
    }
    return w;
  }

  refreshTokens(userId: string, now = Date.now(), idempotencyKey: string): LedgerEntry | null {
    const w = this.wallet(userId, now);
    if (now - w.lastTokenGrantAt < TOKEN_TTL_MS) return null;
    const grant = Math.min(TOKEN_DAILY_GRANT, Math.max(0, TOKEN_BALANCE_CAP - w.tokens));
    w.lastTokenGrantAt = now;
    if (grant <= 0) return null;
    return this.post({
      userId,
      matchId: null,
      reason: "daily_token_grant",
      currency: "tokens",
      amount: grant,
      idempotencyKey,
      now,
    });
  }

  post(input: {
    userId: string;
    matchId: string | null;
    reason: string;
    currency: Currency;
    amount: number;
    idempotencyKey: string;
    now?: number;
  }): LedgerEntry {
    const existing = this.seen.get(input.idempotencyKey);
    if (existing) return existing;
    const w = this.wallet(input.userId, input.now);
    const previous = input.currency === "tokens" ? w.tokens : w.diamonds;
    const next = previous + input.amount;
    if (next < 0) {
      throw new PlatformError(ERROR_CODES.INSUFFICIENT_BALANCE, "Insufficient virtual balance");
    }
    if (input.currency === "tokens") w.tokens = next;
    else w.diamonds = next;
    const entry: LedgerEntry = {
      id: createId("led"),
      userId: input.userId,
      matchId: input.matchId,
      reason: input.reason,
      currency: input.currency,
      amount: input.amount,
      previousBalance: previous,
      resultingBalance: next,
      idempotencyKey: input.idempotencyKey,
      ts: input.now ?? Date.now(),
    };
    this.entries.push(entry);
    this.seen.set(input.idempotencyKey, entry);
    return entry;
  }

  history(userId: string): LedgerEntry[] {
    return this.entries.filter((e) => e.userId === userId).slice(-40).reverse();
  }
}
