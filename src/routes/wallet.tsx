import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

function WalletPage() {
  const { tokens, diamonds, history } = usePlatform();
  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <h1 className="font-display text-4xl tracking-tight">Wallet</h1>
      <p className="mt-2 max-w-xl text-muted">
        Tokens and Diamonds are virtual club chips. There is no cash-out, exchange, or real-money wagering in this
        build.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Tokens</p>
          <p className="mt-2 font-display text-4xl tabular-nums">{tokens ?? "—"}</p>
          <p className="mt-2 text-sm text-muted">Refreshed on a 24-hour TTL. Freemium tables draw from this balance.</p>
        </article>
        <article className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Diamonds</p>
          <p className="mt-2 font-display text-4xl tabular-nums">{diamonds ?? "—"}</p>
          <p className="mt-2 text-sm text-muted">Premium placeholder. Purchase rails are not wired.</p>
        </article>
      </div>
      <h2 className="mt-8 font-display text-2xl">Ledger</h2>
      <ol className="mt-3 grid gap-2">
        {history.length === 0 ? (
          <li className="text-sm text-muted">No movements yet.</li>
        ) : (
          history.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm">
              <span>
                {row.reason}
                <span className="block text-xs text-subtle">{new Date(row.ts).toLocaleString()}</span>
              </span>
              <span className="tabular-nums">
                {row.amount > 0 ? "+" : ""}
                {row.amount} {row.currency === "tokens" ? "T" : "D"}
              </span>
            </li>
          ))
        )}
      </ol>
    </Shell>
  );
}
