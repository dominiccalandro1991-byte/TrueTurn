import { Link } from "@tanstack/react-router";
import { Dices, Settings } from "lucide-react";
import type { ReactNode } from "react";

export function Shell({
  children,
  tokens,
  diamonds,
}: {
  children: ReactNode;
  tokens?: number;
  diamonds?: number;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="font-display text-xl tracking-tight">
            TrueTurn
          </Link>
          <div className="flex items-center gap-2 text-xs tabular-nums text-muted">
            <span className="rounded-full border border-border px-2.5 py-1">Tokens {tokens ?? "—"}</span>
            <span className="rounded-full border border-border px-2.5 py-1">Diamonds {diamonds ?? "—"}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-5xl grid-cols-2">
          <Link to="/" className="flex min-h-12 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] text-muted hover:text-fg">
            <Dices className="size-4" />
            Tables
          </Link>
          <Link
            to="/settings"
            className="flex min-h-12 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] text-muted hover:text-fg"
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </div>
      </nav>
    </div>
  );
}
