const KEY = "trueturn.session.v1";

export interface GuestSession {
  playerId: string;
  displayName: string;
  clientSeed: string;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `guest_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function loadSession(): GuestSession {
  if (typeof window === "undefined") {
    return { playerId: "guest_ssr", displayName: "Player", clientSeed: "table-luck" };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GuestSession;
  } catch {
    /* ignore */
  }
  const session: GuestSession = {
    playerId: randomId(),
    displayName: "Player",
    clientSeed: "table-luck",
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function saveSession(session: GuestSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}
