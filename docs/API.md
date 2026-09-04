# API

Phase 1 preview uses TanStack `createServerFn` on the web origin.

| Function | Intent |
| --- | --- |
| `bootstrapWallet` | Guest wallet + 24h token grant attempt |
| `createMatchFn` | Ante + committed match |
| `getMatchFn` | Projected state (no unrevealed server seed) |
| `actFn` | Validated action, version + idempotency key |
| `tickBotsFn` | One house action |
| `verifyFn` | Reproduce dice or shuffle |
| `createAvatarJobFn` | Mock avatar job |

Error codes: `INVALID_INPUT`, `UNAUTHORIZED`, `NOT_FOUND`, `OUT_OF_TURN`, `ILLEGAL_ACTION`, `STALE_VERSION`, `DUPLICATE_ACTION`, `INSUFFICIENT_BALANCE`, `MATCH_CLOSED`, `SEED_TAMPER`, `RATE_LIMITED`.

WebSocket (deferred live transport; see `apps/server`):

```
auth { playerId }
match.create { gameId, clientSeed }
match.act { matchId, type, payload, version, idempotencyKey }
match.state { matchId }
```
