# Architecture

## Trust

Clients submit **intents**. The coordinator applies a pure engine with HMAC-derived randomness. Clients never finalize dice, cards, pots, or balances.

```
browser → TanStack server function → match coordinator → game-core + provably-fair
                                     ↘ append-only ledger
```

## Layout

- `src/` — mobile-first web client (Vite / TanStack Start)
- `packages/provably-fair` — crypto
- `packages/game-core` — rules, ledger, match wrapper
- `packages/shared` — contracts
- `apps/server` — future WebSocket process (single coordinator, **not Raft**)

## Data

Phase 1 stores matches and the ledger **in process memory**. PostgreSQL is the intended system of record and is not wired. Guest IDs live in `localStorage`.

## Environments

The server issues an `EnvironmentVector`. The client paints a seeded sky from it. Freemium location is hashed from the commitment; Diamonds (when present) allow a pick. Exact “never repeat forever” is not claimed.

## Avatars

Upload is validated then handed to a **mock** adapter that returns a mesh id. No biometric store, no paid provider.
