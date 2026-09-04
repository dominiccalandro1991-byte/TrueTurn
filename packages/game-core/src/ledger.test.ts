import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TOKEN_TTL_MS } from "../../shared/src/constants.ts";
import { Ledger } from "./ledger.ts";

describe("virtual ledger", () => {
  it("is idempotent and rejects insufficient tokens", () => {
    const ledger = new Ledger();
    const a = ledger.post({
      userId: "u1",
      matchId: "m1",
      reason: "ante",
      currency: "tokens",
      amount: -10,
      idempotencyKey: "k1",
    });
    const b = ledger.post({
      userId: "u1",
      matchId: "m1",
      reason: "ante",
      currency: "tokens",
      amount: -10,
      idempotencyKey: "k1",
    });
    assert.equal(a.id, b.id);
    assert.equal(ledger.wallet("u1").tokens, 990);
    assert.throws(() =>
      ledger.post({
        userId: "u1",
        matchId: "m2",
        reason: "ante",
        currency: "tokens",
        amount: -10_000,
        idempotencyKey: "k2",
      }),
    );
  });

  it("grants the 24h token TTL once", () => {
    const ledger = new Ledger();
    ledger.wallet("u1", 0);
    ledger.wallets.get("u1")!.tokens = 100;
    ledger.wallets.get("u1")!.lastTokenGrantAt = 0;
    const grant = ledger.refreshTokens("u1", TOKEN_TTL_MS + 1, "g1");
    assert.ok(grant);
    assert.equal(grant!.amount, 500);
    const again = ledger.refreshTokens("u1", TOKEN_TTL_MS + 2, "g2");
    assert.equal(again, null);
  });
});
