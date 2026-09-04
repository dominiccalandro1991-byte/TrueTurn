import { useEffect } from "react";
import { presenceFn } from "@/lib/platform/api";

declare global {
  interface Window {
    __TRUETURN_PLAYERS_ONLINE?: number;
    __TRUETURN_MATCH?: { match_id?: string; game_id?: string; table_phase?: string };
    __trueturnEmit?: (type: string, severity: string, payload: Record<string, unknown>) => void;
  }
}

export function TelemetryBridge({
  matchId,
  gameId,
  phase,
}: {
  matchId?: string;
  gameId?: string;
  phase?: string;
}) {
  useEffect(() => {
    window.__TRUETURN_MATCH = {
      match_id: matchId,
      game_id: gameId,
      table_phase: phase,
    };
  }, [matchId, gameId, phase]);

  useEffect(() => {
    let cancelled = false;
    async function pulse() {
      try {
        const p = await presenceFn();
        if (!cancelled) window.__TRUETURN_PLAYERS_ONLINE = p.playersOnline;
      } catch {
        /* preview still plays */
      }
    }
    void pulse();
    const id = window.setInterval(pulse, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
