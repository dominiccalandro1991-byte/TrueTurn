import { STARTING_DIAMONDS, STARTING_TOKENS } from "../../../packages/shared/src/constants.ts";
import { useEffect, useState } from "react";
import { bootstrapWallet, getAvatarFn } from "./api.ts";
import { loadSession, saveSession, type GuestSession } from "./session.ts";
import type { AvatarRecord } from "./store.ts";

export function usePlatform() {
  const [session, setSession] = useState<GuestSession>(() => loadSession());
  const [tokens, setTokens] = useState<number | undefined>();
  const [diamonds, setDiamonds] = useState<number | undefined>();
  const [avatar, setAvatar] = useState<AvatarRecord | null>(null);
  const [history, setHistory] = useState<
    { id: string; reason: string; amount: number; currency: string; resultingBalance: number; ts: number }[]
  >([]);

  async function refresh(playerId = session.playerId) {
    try {
      const [w, a] = await Promise.all([
        bootstrapWallet({ data: { playerId } }),
        getAvatarFn({ data: { playerId } }),
      ]);
      setTokens(w.tokens);
      setDiamonds(w.diamonds);
      setHistory(w.history);
      setAvatar(a);
    } catch {
      setTokens(STARTING_TOKENS);
      setDiamonds(STARTING_DIAMONDS);
    }
  }

  useEffect(() => {
    void refresh();
  }, [session.playerId]);

  function update(partial: Partial<GuestSession>) {
    const next = { ...session, ...partial };
    saveSession(next);
    setSession(next);
  }

  return { session, update, tokens, diamonds, history, avatar, refresh, setTokens, setDiamonds };
}
