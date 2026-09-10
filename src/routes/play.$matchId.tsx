import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GAME_CATALOG } from "../../packages/shared/src/games.ts";
import type { ActionPayload } from "../../packages/game-core/src/engine.ts";
import type { MatchPublic } from "../../packages/game-core/src/match.ts";
import { EnvironmentCanvas } from "@/components/environment-canvas";
import { FairnessPanel } from "@/components/fairness-panel";
import { Shell } from "@/components/shell";
import { TableView } from "@/components/table-view";
import { TelemetryBridge } from "@/components/telemetry-bridge";
import { Button } from "@/components/ui/button";
import { actFn, getMatchFn, joinMatchFn, startMatchFn, tickBotsFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/play/$matchId")({ component: Play });

function Play() {
  const { matchId } = Route.useParams();
  const { session, tokens, diamonds } = usePlatform();
  const [match, setMatch] = useState<MatchPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fillBots, setFillBots] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let next = await getMatchFn({ data: { matchId, playerId: session.playerId } });
        const seated = next.view.seats.some((s) => s.id === session.playerId);
        if (!seated && next.phase === "lobby") {
          next = await joinMatchFn({
            data: { table: matchId, playerId: session.playerId, displayName: session.displayName },
          });
        }
        if (!cancelled) setMatch(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Match missing");
      }
    }
    void load();
    const poll = window.setInterval(() => {
      getMatchFn({ data: { matchId, playerId: session.playerId } })
        .then((m) => {
          if (!cancelled) setMatch(m);
        })
        .catch(() => undefined);
    }, 900);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [matchId, session.playerId, session.displayName]);

  useEffect(() => {
    if (!match || match.phase !== "live" || match.view.terminal) return;
    const bot = match.view.seats.find((s) => s.id === match.view.toAct)?.isBot;
    if (!bot) return;
    const t = window.setTimeout(() => {
      tickBotsFn({ data: { matchId, playerId: session.playerId } }).then(setMatch).catch(() => undefined);
    }, 420);
    return () => window.clearTimeout(t);
  }, [match, matchId, session.playerId]);

  async function onAction(type: string, payload?: ActionPayload) {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      if (type === "start") {
        const next = await startMatchFn({
          data: { matchId: match.id, playerId: session.playerId, fillBots },
        });
        setMatch(next);
        return;
      }
      const next = await actFn({
        data: {
          matchId,
          playerId: session.playerId,
          type,
          payload,
          clientActionNonce: match.version,
          matchVersion: match.version,
          idempotencyKey: `${matchId}_${match.version}_${type}`,
        },
      });
      setMatch(next);
    } catch {
      setError("That move was not allowed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!match) return;
    const url =
      import.meta.env.VITE_PAGES === "1"
        ? `${window.location.origin}${import.meta.env.BASE_URL}#/play/${match.code}`
        : `${window.location.origin}/play/${match.code}`;
    try {
      await navigator.clipboard.writeText(`${match.code}  ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copy failed — share the table code instead");
    }
  }

  const title = match ? GAME_CATALOG[match.gameId].title : "Table";

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <TelemetryBridge matchId={match?.id} gameId={match?.gameId} phase={match?.phase} />
      <div className="relative overflow-hidden rounded-[var(--radius-xl)]">
        {match ? (
          <EnvironmentCanvas environment={match.environment} className="absolute inset-0 h-full w-full" />
        ) : null}
        <div className="relative grid gap-4 bg-bg/70 p-4 backdrop-blur-[2px] sm:p-6">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {match ? (
            <>
              {match.phase === "lobby" ? (
                <div className="grid gap-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{title}</p>
                  <h1 className="font-display text-3xl tracking-tight">Table {match.code}</h1>
                  <p className="max-w-xl text-muted">
                    Deep link is this page. Family sits with the code or this URL. Empty seats can take house logic at
                    start. Disconnects get a bot takeover.
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {match.view.seats.map((seat) => (
                      <li
                        key={seat.id}
                        className="rounded-full border border-border px-3 py-1 text-xs"
                      >
                        {seat.id.startsWith("open_") ? "Open seat" : seat.name}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={copyInvite}>{copied ? "Copied" : "Copy invite"}</Button>
                    {match.hostId === session.playerId ? (
                      <>
                        <label className="flex items-center gap-2 text-sm text-muted">
                          <input type="checkbox" checked={fillBots} onChange={(e) => setFillBots(e.target.checked)} />
                          House fills empty seats
                        </label>
                        <Button
                          disabled={busy || (match.view.legal.length === 0 && !fillBots)}
                          onClick={() => onAction("start")}
                        >
                          Start table
                        </Button>
                      </>
                    ) : (
                      <p className="self-center text-sm text-muted">Waiting on the host to start.</p>
                    )}
                  </div>
                </div>
              ) : (
                <TableView match={match} playerId={session.playerId} busy={busy} onAction={onAction} />
              )}
              <FairnessPanel fairness={match.fairness} />
            </>
          ) : (
            <p className="text-muted">Setting the table…</p>
          )}
        </div>
      </div>
    </Shell>
  );
}
