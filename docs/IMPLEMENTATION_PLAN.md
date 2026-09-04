# TrueTurn Implementation Plan

Phase 1 foundation for the Global Multiplayer Stochastic Game Platform.
Product name: **TrueTurn**. Virtual Tokens and Diamonds only — not money.

## Stack decision (Phase 1)

The live App Builder workspace is Vite + TanStack Start + React 19 + Tailwind v4.
AGENTS architecture prefers Next.js “subject to existing repository conventions.”

**Decision:** Phase 1 ships as Vite + TanStack Start (not Next.js) so the playable
client matches the preview/deploy contract. Shared engines remain framework-agnostic
TypeScript packages. A Node WebSocket server is scaffolded under `apps/server`
and uses the same engines. Next.js is deferred, not rejected.

## Milestone 0 — Repo & tooling

- [x] Inspect workspace conventions
- [ ] Create `voltcore-org/TrueTurn` (blocked if caller is not an org member with repo-create)
- [x] Monorepo packages: `shared`, `provably-fair`, `game-core`
- [x] Strict TypeScript, tests, docs skeleton, `.env.example`
- [x] Feature branch target: `grok/initial-platform-foundation`

## Milestone 1 — Provably fair RNG (first)

- [x] CSPRNG 256-bit server seed
- [x] Client seed validation (32 bytes / 64 hex / passphrase→SHA-256)
- [x] HMAC-SHA256 stream: `H = HMAC-SHA256(S_server, S_client ∥ N ∥ block)`
- [x] SHA-256 commitment, reveal, tamper detection
- [x] Bias-resistant dice via rejection sampling (not raw `H mod 6`)
- [x] Cryptographic Fisher–Yates
- [x] Test vectors + unit tests
- [x] `docs/PROVABLY_FAIR.md`

## Milestone 2 — Game engines

Pure deterministic state machines in `packages/game-core`:

- [x] Farkle / 10,000
- [x] Ship, Captain, Crew
- [x] Craps (Pass Line)
- [x] Card primitives + Fisher–Yates deal
- [x] Texas Hold’em (evaluator + betting FSM)
- [x] Spades
- [x] Hearts
- [x] Pitch / Setback
- [x] Single-deck classic Pinochle

## Milestone 3 — Authoritative session layer

- [x] In-process match coordinator (server-authoritative)
- [x] Action nonces, match versions, idempotency keys
- [x] Hidden information projection
- [x] Virtual token/diamond ledger (append-only, no cash-out)
- [x] WebSocket protocol scaffold (`apps/server`) — preview uses server functions

## Milestone 4 — Web client

- [x] Mobile-first lobby, table, verify, wallet, avatar
- [x] Playable dice + card surfaces
- [x] Provably-fair verification UI
- [x] Seeded procedural environment (canvas/WebGL fallback)
- [x] Mock avatar pipeline (no paid AI required)

## Deferred / not in this build

- Real-money payments, withdrawals, sweepstakes, gambling licensing
- Production auth / PostgreSQL / Redis / Raft
- Paid AI avatar providers (mock adapter only)
- Distributed match coordinators
- Next.js migration

## Configuration decisions (underspecified rules)

See `docs/GAME_RULES.md` for the full list. Conservative defaults:

- Farkle: maximize score over legal partitions; hot dice force reroll (cannot bank).
- Ship/Captain/Crew: cargo dice may be rerolled if 6-5-4 secured and rolls remain.
- Hearts: 2♣ leads first trick; play continues until a player reaches 100.
- Spades: left of dealer leads; spades cannot be led until broken unless only spades.
- Pitch: bidder leads; follow suit; Game point from captured cards.
- Pinochle: run includes trump marriage (no double-count); must-beat when possible.
