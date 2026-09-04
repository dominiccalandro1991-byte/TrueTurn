import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GAME_CATALOG, GAME_IDS } from "../../packages/shared/src/games.ts";
import { ENVIRONMENT_LOCATIONS } from "../../packages/shared/src/constants.ts";
import type { TableListing } from "../../packages/game-core/src/match.ts";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { TelemetryBridge } from "@/components/telemetry-bridge";
import { createMatchFn, joinMatchFn, listTablesFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/")({ component: Lobby });

function Lobby() {
  const { session, update, tokens, diamonds } = usePlatform();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [tables, setTables] = useState<TableListing[]>([]);
  const [location, setLocation] = useState<(typeof ENVIRONMENT_LOCATIONS)[number]>("observatory");
  const [seats, setSeats] = useState(4);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const next = await listTablesFn();
        if (!cancelled) setTables(next);
      } catch {
        /* empty club is fine */
      }
    }
    void refresh();
    const id = window.setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function openTable(gameId: (typeof GAME_IDS)[number]) {
    setBusy(gameId);
    setError(null);
    try {
      const catalog = GAME_CATALOG[gameId];
      const match = await createMatchFn({
        data: {
          gameId,
          playerId: session.playerId,
          displayName: session.displayName,
          clientSeed: session.clientSeed,
          seatCount: Math.min(catalog.seats.max, Math.max(catalog.seats.min, seats)),
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

  async function joinTable(table: string) {
    setBusy("join");
    setError(null);
    try {
      const match = await joinMatchFn({
        data: { table: table.trim(), playerId: session.playerId, displayName: session.displayName },
      });
      await navigate({ to: "/play/$matchId", params: { matchId: match.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <TelemetryBridge phase="lobby" />
      <section className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Virtual club · real people · no cash-out</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">The table does not blink.</h1>
        <p className="mt-3 max-w-xl text-muted">
          Open a table, copy the four-letter code, send it to family. They sit in the open seats. You start. Same
          dice, same cards, no house bots.
        </p>
      </section>

      <form
        className="mb-6 grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode.trim()) void joinTable(joinCode);
        }}
      >
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
        <label className="grid gap-1 text-sm">
          Seats
          <select
            className="min-h-11 rounded-[var(--radius-md)] border border-border bg-bg px-3"
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} people
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Join with table code
          <span className="flex gap-2">
            <input
              className="min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 uppercase"
              value={joinCode}
              maxLength={80}
              placeholder="K7M2"
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <Button type="submit" disabled={busy !== null || !joinCode.trim()}>
              Sit
            </Button>
          </span>
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

      {tables.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl">Open tables</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {tables.map((table) => (
              <button
                key={table.id}
                type="button"
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-3 text-left"
                onClick={() => void joinTable(table.code)}
              >
                <p className="font-mono text-lg tracking-[0.2em]">{table.code}</p>
                <p className="text-sm text-muted">
                  {GAME_CATALOG[table.gameId].title} · {table.seated}/{table.seatCount} · {table.phase} · host{" "}
                  {table.hostName}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

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
              <Button className="mt-4 w-full" disabled={busy !== null} onClick={() => openTable(id)}>
                {busy === id ? "Opening…" : `Open table · ${game.anteTokens} T`}
              </Button>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}
