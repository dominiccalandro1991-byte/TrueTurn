import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GAME_CATALOG, GAME_IDS } from "../../packages/shared/src/games.ts";
import { ENVIRONMENT_LOCATIONS } from "../../packages/shared/src/constants.ts";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { createMatchFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: Lobby });

function Lobby() {
  const { session, update, tokens, diamonds } = usePlatform();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<(typeof ENVIRONMENT_LOCATIONS)[number]>("observatory");

  async function start(gameId: (typeof GAME_IDS)[number]) {
    setBusy(gameId);
    setError(null);
    try {
      const match = await createMatchFn({
        data: {
          gameId,
          playerId: session.playerId,
          displayName: session.displayName,
          clientSeed: session.clientSeed,
          environmentLocation: diamonds ? location : undefined,
          idempotencyKey: `open_${gameId}_${Date.now()}`,
        },
      });
      await navigate({ to: "/play/$matchId", params: { matchId: match.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the table");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <section className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Virtual club · no cash-out</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">The table does not blink.</h1>
        <p className="mt-3 max-w-xl text-muted">
          Eight deterministic games. Server-authoritative dice and cards. Every roll is committed before it lands.
          Tokens and Diamonds are non-withdrawable club chips.
        </p>
      </section>

      <form className="mb-8 grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Display name
          <input
            className="min-h-11 rounded-[var(--radius-md)] border border-border bg-bg px-3"
            value={session.displayName}
            maxLength={24}
            onChange={(e) => update({ displayName: e.target.value || "Player" })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Luck phrase
          <input
            className="min-h-11 rounded-[var(--radius-md)] border border-border bg-bg px-3"
            value={session.clientSeed}
            maxLength={64}
            onChange={(e) => update({ clientSeed: e.target.value || "table-luck" })}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Table climate {diamonds ? "" : "(randomized — Diamonds unlock a pick)"}
          <select
            className="min-h-11 rounded-[var(--radius-md)] border border-border bg-bg px-3"
            value={location}
            disabled={!diamonds}
            onChange={(e) => setLocation(e.target.value as (typeof ENVIRONMENT_LOCATIONS)[number])}
          >
            {ENVIRONMENT_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
      </form>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {GAME_IDS.map((id) => {
          const game = GAME_CATALOG[id];
          return (
            <article key={id} className="rounded-[var(--radius-xl)] border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">{game.family}</p>
              <h2 className="mt-1 font-display text-2xl">{game.title}</h2>
              <p className="mt-2 text-sm text-muted">{game.blurb}</p>
              <p className="mt-3 text-xs text-subtle">{game.objective}</p>
              <Button className="mt-4 w-full" disabled={busy !== null} onClick={() => start(id)}>
                {busy === id ? "Opening…" : `Sit · ${game.anteTokens} T`}
              </Button>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}
