# Provably fair randomness

TrueTurn never uses `Math.random()`, Mersenne Twister, or timestamps for game outcomes.

## Construction

- `S_server`: 32 cryptographically random bytes
- `S_client`: 32 bytes (hex) or SHA-256 of a luck phrase
- `N`: integer nonce, incremented once per RNG action (a roll or a shuffle)
- Block `k` = `HMAC-SHA256(S_server, S_client ∥ N_u64be ∥ k_u32be)`
- The original spec hash `H = HMAC-SHA256(S_server, S_client ∥ N)` is block `k = 0`

## Commitment

Before any outcome, the table publishes `SHA-256(S_server)` as a hex commitment. The raw server seed is withheld until the match is terminal.

## Dice

The spec’s `Outcome = (H mod 6) + 1` is slightly biased because `2^256` is not divisible by 6. Live dice use **rejection sampling** on stream bytes: accept `0..251`, reject `252..255`, then `byte % 6 + 1`.

## Cards

Fisher–Yates using unbiased integers from the same HMAC stream (32-bit rejection sampling for each swap index). The stream is expanded with `k` so a 52-card shuffle never reuses a single digest.

## Independent verification

1. After the match, take the revealed server seed, your client seed, the nonce, and the published commitment.
2. Check `SHA-256(serverSeed) === commitment`.
3. Replay dice or the shuffle with the public verifier (`/verify` or `verifyDice` / `verifyShuffle`).

Frozen test vectors live in `packages/provably-fair/src/vectors.ts`.
