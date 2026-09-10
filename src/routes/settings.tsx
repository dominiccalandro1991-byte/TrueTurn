import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ENVIRONMENT_LOCATIONS } from "../../packages/shared/src/constants.ts";
import { WARDROBE } from "../../packages/shared/src/wardrobe.ts";
import { AvatarCapture } from "@/components/avatar-capture";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buyWardrobeFn, createSquadFn, joinSquadFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { session, update, tokens, diamonds, history, avatar, refresh } = usePlatform();
  const [section, setSection] = useState<"account" | "avatar" | "wallet" | "table" | "squad" | "fairness">("account");
  const [squad, setSquad] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <h1 className="font-display text-4xl tracking-tight">Settings</h1>
      <p className="mt-2 max-w-xl text-muted">Account, avatar, wallet, table climate, squads. The lobby stays empty of this.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(["account", "avatar", "wallet", "table", "squad", "fairness"] as const).map((id) => (
          <Button key={id} variant={section === id ? "primary" : "ghost"} size="sm" onClick={() => setSection(id)}>
            {id}
          </Button>
        ))}
      </div>

      {section === "account" ? (
        <form className="mt-6 grid max-w-lg gap-3">
          <label className="grid gap-1 text-sm">
            Display name
            <input
              className="min-h-11 rounded-[var(--radius-md)] border border-border bg-bg px-3"
              value={session.displayName}
              maxLength={24}
              onChange={(e) => update({ displayName: e.target.value || "Player" })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Luck phrase (client seed)
            <input
              className="min-h-11 rounded-[var(--radius-md)] border border-border bg-bg px-3"
              value={session.clientSeed}
              maxLength={64}
              onChange={(e) => update({ clientSeed: e.target.value || "table-luck" })}
            />
          </label>
        </form>
      ) : null}

      {section === "avatar" ? (
        <div className="mt-6 grid max-w-lg gap-4">
          <p className="text-sm text-muted">
            Mesh {avatar?.meshId ?? "none"} · wardrobe {avatar?.wardrobe.join(", ") || "bare"}
          </p>
          <AvatarCapture
            playerId={session.playerId}
            onReady={async () => {
              await refresh();
            }}
          />
          <div className="grid gap-2">
            {WARDROBE.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                disabled={!avatar?.instantiated}
                onClick={async () => {
                  try {
                    await buyWardrobeFn({
                      data: {
                        playerId: session.playerId,
                        itemId: item.id,
                        idempotencyKey: `w_${session.playerId}_${item.id}`,
                      },
                    });
                    await refresh();
                    setMsg(`Equipped ${item.label}`);
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Purchase failed");
                  }
                }}
              >
                {item.label} · {item.cost} {item.currency}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {section === "wallet" ? (
        <div className="mt-6 grid gap-3">
          <p className="text-sm text-muted">Virtual chips only. Ledger is idempotent and rejects negative balances.</p>
          <ol className="grid gap-2">
            {history.map((row) => (
              <li key={row.id} className="flex justify-between rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm">
                <span>{row.reason}</span>
                <span className="tabular-nums">
                  {row.amount > 0 ? "+" : ""}
                  {row.amount} {row.currency}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {section === "table" ? (
        <p className="mt-6 max-w-lg text-sm text-muted">
          Premium climate pick unlocks when you hold Diamonds. Locations rotate each round from the committed seed:
          {ENVIRONMENT_LOCATIONS.join(", ")}.
        </p>
      ) : null}

      {section === "squad" ? (
        <div className="mt-6 grid max-w-lg gap-3">
          <Button
            onClick={async () => {
              const s = await createSquadFn({
                data: { playerId: session.playerId, displayName: session.displayName },
              });
              setSquad(s.code);
              setMsg(`Squad ${s.code}`);
            }}
          >
            New squad
          </Button>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const s = await joinSquadFn({
                data: { playerId: session.playerId, displayName: session.displayName, code: squad },
              });
              setMsg(`Seated in ${s.code} · ${s.members.length}`);
            }}
          >
            <input
              className="min-h-11 flex-1 rounded-[var(--radius-md)] border border-border bg-bg px-3 uppercase"
              value={squad}
              placeholder="SQUAD"
              onChange={(e) => setSquad(e.target.value)}
            />
            <Button type="submit">Link</Button>
          </form>
        </div>
      ) : null}

      {section === "fairness" ? (
        <p className="mt-6 max-w-lg text-sm text-muted">
          Dice and shuffles are HMAC-SHA256 on the server. The client never holds the live seed. Reveal happens only
          when a match closes. Verify a finished table from its fairness panel.
        </p>
      ) : null}

      {msg ? <p className="mt-4 text-sm text-muted">{msg}</p> : null}
    </Shell>
  );
}
