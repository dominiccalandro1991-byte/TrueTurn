# Threat model (Phase 1)

## Assets

Guest session ids, unrevealed server seeds, ledger balances, match state, uploaded face stills.

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| Client fakes a roll | RNG only on server; seed withheld until terminal |
| Replay / double spend | Idempotency keys, match versions, action nonce |
| Out-of-turn play | Engine rejects; coordinator maps to `OUT_OF_TURN` |
| Commitment lie | Public SHA-256 check |
| Mod-6 bias | Rejection sampling |
| Secret leak | `.gitignore`, `.env.example` placeholders, secret scan |
| Avatar biometrics | Mock adapter, consent gate, no retention claim as a store |
| XSS | React encoding, no `dangerouslySetInnerHTML` |
| CSRF on server fns | Same-origin TanStack functions |

## Assumptions

- Preview trust: guest ids are client-held. Not production auth.
- Memory store is not durable and not multi-instance safe.
- Not legally reviewed for gambling, age-gating, or privacy regimes.
