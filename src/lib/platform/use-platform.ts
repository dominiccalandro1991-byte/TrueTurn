import { STARTING_DIAMONDS, STARTING_TOKENS } from "../../../packages/shared/src/constants.ts";
import { useEffect, useState } from "react";
import { bootstrapWallet } from "./api.ts";
import { loadSession, saveSession, type GuestSession } from "./session.ts";

export function usePlatform() {
  const [session, setSession] = useState<GuestSession>(() => loadSession());
  const [tokens, setTokens] = useState<number | undefined>();
  const [diamonds, setDiamonds] = useState<number | undefined>();
  const [history, setHistory] = useState<
    { id: string; reason: string; amount: number; currency: string; resultingBalance: number; ts: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    bootstrapWallet({ data: { playerId: session.playerId } })
      .then((w) => {
        if (cancelled) return;
        setTokens(w.tokens);
        setDiamonds(w.diamonds);
        setHistory(w.history);
      })
      .catch(() => {
        if (cancelled) return;
        setTokens(STARTING_TOKENS);
        setDiamonds(STARTING_DIAMONDS);
      });
    return () => {
      cancelled = true;
    };
  }, [session.playerId]);

  function update(partial: Partial<GuestSession>) {
    const next = { ...session, ...partial };
    saveSession(next);
    setSession(next);
  }

  return { session, update, tokens, diamonds, history, setTokens, setDiamonds };
}
