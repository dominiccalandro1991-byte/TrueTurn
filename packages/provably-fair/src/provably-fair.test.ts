import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromHex, toHex } from "./bytes.ts";
import { dieNaiveMod6, rollDice } from "./dice.ts";
import { hmacSha256, sha256 } from "./hash.ts";
import { commitServerSeed, parseClientSeed, verifyCommitment } from "./seeds.ts";
import { fisherYates } from "./shuffle.ts";
import { HmacStream, specHash } from "./stream.ts";
import { TEST_VECTORS } from "./vectors.ts";
import { verifyDice } from "./verify.ts";

const server = fromHex(TEST_VECTORS.serverSeedHex);
const client = fromHex(TEST_VECTORS.clientSeedHex);

describe("provably-fair seeds", () => {
  it("commits SHA-256 of the server seed", async () => {
    const commitment = await commitServerSeed(server);
    assert.equal(commitment, TEST_VECTORS.expected.commitment);
    assert.equal(commitment, toHex(await sha256(server)));
  });

  it("detects a tampered server seed", async () => {
    const commitment = await commitServerSeed(server);
    const tampered = server.slice();
    tampered[0] = tampered[0]! ^ 0xff;
    assert.equal(await verifyCommitment(tampered, commitment), false);
  });

  it("hashes passphrases into 256-bit client seeds", async () => {
    const a = await parseClientSeed("table-luck");
    const b = await parseClientSeed("table-luck");
    const c = await parseClientSeed("table-luck-2");
    assert.equal(a.length, 32);
    assert.deepEqual([...a], [...b]);
    assert.notDeepEqual([...a], [...c]);
  });

  it("accepts 64-char hex client seeds", async () => {
    const parsed = await parseClientSeed(TEST_VECTORS.clientSeedHex);
    assert.deepEqual([...parsed], [...client]);
  });
});

describe("HMAC construction", () => {
  it("matches HMAC-SHA256(S_server, S_client || N || block0)", async () => {
    const h = await specHash(server, client, 0);
    assert.equal(h.length, 32);
    const stream = new HmacStream(server, client, 0);
    const first = await stream.nextBytes(32);
    assert.deepEqual([...h], [...first]);
  });

  it("changes output when nonce increments", async () => {
    const a = await specHash(server, client, 0);
    const b = await specHash(server, client, 1);
    assert.notDeepEqual([...a], [...b]);
  });

  it("is reproducible", async () => {
    const a = await hmacSha256(server, client);
    const b = await hmacSha256(server, client);
    assert.deepEqual([...a], [...b]);
  });
});

describe("dice derivation", () => {
  it("reproduces frozen test vectors", async () => {
    const stream = new HmacStream(server, client, TEST_VECTORS.nonce0);
    const dice = await rollDice(stream, 6);
    assert.deepEqual(dice, [...TEST_VECTORS.expected.diceNonce0x6]);
  });

  it("reproduces a second nonce independently", async () => {
    const stream = new HmacStream(server, client, TEST_VECTORS.nonce1);
    const dice = await rollDice(stream, 2);
    assert.deepEqual(dice, [...TEST_VECTORS.expected.diceNonce1x2]);
  });

  it("is in 1..6 and statistically sane over 12k rolls", async () => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let n = 0; n < 2000; n++) {
      const stream = new HmacStream(server, client, n + 10);
      const dice = await rollDice(stream, 6);
      for (const d of dice) {
        assert.ok(d >= 1 && d <= 6);
        counts[d]! += 1;
      }
    }
    const total = 12_000;
    for (let face = 1; face <= 6; face++) {
      const p = counts[face]! / total;
      assert.ok(p > 0.14 && p < 0.20, `face ${face} frequency ${p}`);
    }
  });

  it("documents naive mod-6 as a different mapping", async () => {
    const digest = await specHash(server, client, 0);
    const naive = dieNaiveMod6(digest);
    assert.ok(naive >= 1 && naive <= 6);
  });
});

describe("Fisher-Yates", () => {
  it("reproduces a frozen permutation", async () => {
    const stream = new HmacStream(server, client, 0);
    const order = await fisherYates([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], stream);
    assert.deepEqual(order, [...TEST_VECTORS.expected.shuffle0to9]);
  });

  it("is a permutation of the input", async () => {
    const stream = new HmacStream(server, client, 3);
    const input = Array.from({ length: 52 }, (_, i) => i);
    const order = await fisherYates(input, stream);
    assert.deepEqual([...order].sort((a, b) => a - b), input);
    assert.notDeepEqual(order, input);
  });
});

describe("public verifier", () => {
  it("accepts honest reveal", async () => {
    const commitment = await commitServerSeed(server);
    const result = await verifyDice({
      serverSeedHex: TEST_VECTORS.serverSeedHex,
      clientSeedHex: TEST_VECTORS.clientSeedHex,
      nonce: 0,
      commitmentHex: commitment,
      count: 6,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.dice, [...TEST_VECTORS.expected.diceNonce0x6]);
  });

  it("rejects a swapped server seed", async () => {
    const commitment = await commitServerSeed(server);
    const result = await verifyDice({
      serverSeedHex: "33".repeat(32),
      clientSeedHex: TEST_VECTORS.clientSeedHex,
      nonce: 0,
      commitmentHex: commitment,
      count: 6,
    });
    assert.equal(result.ok, false);
    assert.equal(result.commitmentMatches, false);
  });
});
