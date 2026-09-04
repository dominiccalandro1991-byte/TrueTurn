import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ActionPayload } from "../../packages/game-core/src/engine.ts";
import type { MatchPublic } from "../../packages/game-core/src/match.ts";
import { EnvironmentCanvas } from "@/components/environment-canvas";
import { FairnessPanel } from "@/components/fairness-panel";
import { Shell } from "@/components/shell";
import { TableView } from "@/components/table-view";
import { actFn, getMatchFn, tickBotsFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/play/$matchId")({ component: Play });

function Play() {
  const { matchId } = Route.useParams();
  const { session, tokens, diamonds } = usePlatform();
  const [match, setMatch] = useState<MatchPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMatchFn({ data: { matchId, playerId: session.playerId } })
      .then((m) => {
        if (!cancelled) setMatch(m);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Match missing"));
    return () => {
      cancelled = true;
    };
  }, [matchId, session.playerId]);

  useEffect(() => {
    if (!match || match.view.terminal) return;
    const toAct = match.view.toAct;
    const bot = match.view.seats.find((s) => s.id === toAct)?.isBot;
    if (!bot) return;
    const t = window.setTimeout(() => {
      tickBotsFn({ data: { matchId, playerId: session.playerId } }).then(setMatch).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(t);
  }, [match, matchId, session.playerId]);

  async function onAction(type: string, payload?: ActionPayload) {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
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

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <div className="relative overflow-hidden rounded-[var(--radius-xl)]">
        {match ? (
          <EnvironmentCanvas environment={match.environment} className="absolute inset-0 h-full w-full" />
        ) : null}
        <div className="relative grid gap-4 bg-bg/70 p-4 backdrop-blur-[2px] sm:p-6">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {match ? (
            <>
              <TableView match={match} playerId={session.playerId} busy={busy} onAction={onAction} />
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
