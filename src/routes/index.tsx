import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GAME_CATALOG, GAME_IDS } from "../../packages/shared/src/games.ts";
import type { TableListing } from "../../packages/game-core/src/match.ts";
import { AvatarCapture } from "@/components/avatar-capture";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { TelemetryBridge } from "@/components/telemetry-bridge";
import { createMatchFn, joinMatchFn, listTablesFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/")({ component: Lobby });

function Lobby() {
  const { session, tokens, diamonds, avatar, refresh } = usePlatform();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [squadCode, setSquadCode] = useState("");
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
          squadCode: squadCode || undefined,
          idempotencyKey: `open_${gameId}_${Date.now()}`,
        },
      });
      await navigate({ to: "/play/$matchId", params: { matchId: match.code } });
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
      await navigate({ to: "/play/$matchId", params: { matchId: match.code } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <TelemetryBridge phase="lobby" />
      {!avatar?.instantiated ? (
        <section className="mb-8">
          <h1 className="font-display text-4xl tracking-tight">Sit for a still.</h1>
          <p className="mt-2 max-w-xl text-muted">The club needs a mesh before you open a table.</p>
          <div className="mt-4">
            <AvatarCapture playerId={session.playerId} onReady={() => void refresh()} />
          </div>
        </section>
      ) : (
        <>
          <section className="mb-6 max-w-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">TrueTurn</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight">Pick a table.</h1>
          </section>
          <form
            className="mb-6 flex flex-wrap gap-2"
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
            <input
              className="min-h-11 w-28 rounded-[var(--radius-md)] border border-border bg-bg px-3 uppercase"
              placeholder="SQUAD"
              value={squadCode}
              onChange={(e) => setSquadCode(e.target.value)}
            />
          </form>
          {tables.length ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="rounded-full border border-border px-3 py-2 font-mono text-sm"
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
        </>
      )}
    </Shell>
  );
}
