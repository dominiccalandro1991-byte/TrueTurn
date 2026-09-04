# TrueTurn

Server-authoritative multiplayer dice and card club. Every roll is committed before it lands. Tokens and Diamonds are **virtual only** — there is no cash-out, exchange, or real-money gambling in this build.

## Play (web)

Open the live preview. Sit at **10,000**. Roll. Keep scoring dice. Bank. House bots take the other seats.

## Native (App Store + Play Store)

Capacitor shells are in this repo.

- Bundle ID: `com.backroadinc.trueturn`
- iOS: `npm run native:ios`
- Android: `npm run native:android`
- Listing copy, privacy policy, and remaining paid gates: [store/README.md](store/README.md)

## Local preview (this workspace)

```sh
npm install
npm run test:engines
npm run dev
```

The web client is Vite + TanStack Start + React. Shared engines live in `packages/`.

## Packages

- `packages/provably-fair` — HMAC-SHA256 commitment, bias-resistant dice, Fisher–Yates
- `packages/game-core` — deterministic state machines for eight games + virtual ledger
- `packages/shared` — types, catalogs, error codes, Zod contracts
- `apps/server` — health/WebSocket scaffold (not Raft; single coordinator)

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Provably fair](docs/PROVABLY_FAIR.md)
- [Game rules](docs/GAME_RULES.md)
- [API](docs/API.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Operations](docs/OPERATIONS.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Store deploy](store/README.md)

## Phase 1 limits

- Guest sessions (no production auth)
- In-memory matches (process-local)
- Mock avatar adapter
- No payments
- No distributed consensus
