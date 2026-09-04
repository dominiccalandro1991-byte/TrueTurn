import { ShieldCheck } from "lucide-react";
import type { FairnessPublic } from "../../packages/game-core/src/match.ts";

export function FairnessPanel({ fairness }: { fairness: FairnessPublic }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <ShieldCheck className="size-4 text-accent" />
        <h2 className="font-medium">Provably fair</h2>
      </div>
      <dl className="grid gap-2 font-mono text-[11px] text-muted">
        <div>
          <dt className="text-subtle">Server commitment</dt>
          <dd className="break-all text-fg">{fairness.commitment}</dd>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-subtle">Nonce</dt>
            <dd className="text-fg">{fairness.nextNonce - 1}</dd>
          </div>
          <div>
            <dt className="text-subtle">Last roll</dt>
            <dd className="text-fg">{fairness.lastRoll ? fairness.lastRoll.dice.join("–") : "—"}</dd>
          </div>
        </div>
        <div>
          <dt className="text-subtle">Server seed</dt>
          <dd className="break-all text-fg">
            {fairness.revealedServerSeed ?? "Hidden until the match resolves"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
