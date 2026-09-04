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
import { actFn, getMatchFn, joinMatchFn, startMatchFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/play/$matchId")({ component: Play });

function Play() {
  const { matchId } = Route.useParams();
  const { session, tokens, diamonds } = usePlatform();
  const [match, setMatch] = useState<MatchPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function onAction(type: string, payload?: ActionPayload) {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      if (type === "start") {
        const next = await startMatchFn({ data: { matchId: match.id, playerId: session.playerId } });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action rejected");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!match) return;
    const url = `${window.location.origin}/play/${match.id}`;
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
                    Send this page to your family. They sit in an open seat under their own name. You start when
                    everyone is in. No house bots.
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
                      <Button
                        disabled={busy || match.view.legal.length === 0}
                        onClick={() => onAction("start")}
                      >
                        Start table
                      </Button>
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
