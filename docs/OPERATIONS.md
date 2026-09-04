# Operations

## Commands

- `npm test` — unit tests including RNG vectors and game rules
- `npm run typecheck`
- `npm run build`
- `npm run dev` — web preview
- `node apps/server/src/index.ts` — health process only

## Migrations

None in Phase 1. Future PostgreSQL migrations will live under `infra/`.

## Rollback

Matches are ephemeral. Restarting the process drops tables. Do not treat in-memory balances as durable.

## Observability

No production log drain yet. Do not log seeds, luck phrases, or upload bytes.
