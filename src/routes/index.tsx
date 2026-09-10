import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GAME_CATALOG, GAME_IDS } from "../../packages/shared/src/games.ts";
import type { TableListing } from "../../packages/game-core/src/match.ts";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { TelemetryBridge } from "@/components/telemetry-bridge";
import { createMatchFn, joinMatchFn, listTablesFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/")({ component: Lobby });

function Lobby() {
  const { session, tokens, diamonds } = usePlatform();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [tables, setTables] = useState<TableListing[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const next = await listTablesFn();
        if (!cancelled) setTables(next);
      } catch {
        /* empty */
      }
    }
    void tick();
    const id = window.setInterval(tick, 2000);
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
          seatCount: catalog.seats.default,
          fillBots: false,
          idempotencyKey: `open_${gameId}_${Date.now()}`,
        },
      });
      await navigate({ to: "/play/$matchId", params: { matchId: match.code } });
    } catch {
      setError("Could not open the table. Try again.");
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
      await navigate({ to: "/play/$matchId", params: { matchId: match.code } });
    } catch {
      setError("Table not found. Check the code.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <TelemetryBridge phase="lobby" />
      <section className="mb-6 max-w-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">TrueTurn</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Pick a table.</h1>
        <p className="mt-2 text-sm text-muted">Open a game, copy the invite, send it. Camera is optional in Settings.</p>
      </section>
      <form
        className="mb-6 grid gap-2 sm:flex sm:flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode.trim()) void joinTable(joinCode);
        }}
      >
        <input
          className="min-h-11 min-w-40 flex-1 rounded-[var(--radius-md)] border border-border bg-bg px-3 uppercase"
          placeholder="TABLE CODE"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
        />
        <Button type="submit" disabled={!joinCode.trim()}>
          Sit
        </Button>
      </form>
      {tables.length ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              className="min-h-11 rounded-full border border-border px-3 py-2 font-mono text-sm"
              onClick={() => void joinTable(t.code)}
            >
              {t.code} · {GAME_CATALOG[t.gameId].title} · {t.seated}/{t.seatCount}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {GAME_IDS.map((id) => {
          const game = GAME_CATALOG[id];
          return (
            <button
              key={id}
              type="button"
              disabled={busy !== null}
              onClick={() => void openTable(id)}
              className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-left"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted">{game.family}</p>
              <h2 className="mt-1 font-display text-2xl">{game.title}</h2>
              <p className="mt-2 text-sm text-muted">{game.blurb}</p>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
