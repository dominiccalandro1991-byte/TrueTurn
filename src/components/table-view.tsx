import { useState } from "react";
import type { ActionPayload, GameView } from "../../packages/game-core/src/engine.ts";
import type { MatchPublic } from "../../packages/game-core/src/match.ts";
import { Button } from "@/components/ui/button";
import { DiceFace } from "@/components/dice-face";
import { CardBack, PlayingCard } from "@/components/playing-card";
import { cn } from "@/lib/utils";

export function TableView({
  match,
  playerId,
  busy,
  onAction,
}: {
  match: MatchPublic;
  playerId: string;
  busy: boolean;
  onAction: (type: string, payload?: ActionPayload) => void;
}) {
  const view = match.view;
  const [picked, setPicked] = useState<number[]>([]);
  const [pickedCards, setPickedCards] = useState<string[]>([]);
  const myTurn = view.toAct === playerId && !view.terminal;

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{match.environment.location}</p>
          <h1 className="font-display text-3xl tracking-tight">{view.prompt}</h1>
        </div>
        {typeof view.pot === "number" ? (
          <p className="rounded-full border border-border px-3 py-1 text-sm tabular-nums">Pot {view.pot}</p>
        ) : null}
      </div>

      <ScoreStrip view={view} />

      {view.dice && view.dice.length > 0 ? (
        <div className="felt rounded-[var(--radius-xl)] p-5">
          <div className="flex flex-wrap justify-center gap-3">
            {view.dice.map((d, i) => (
              <DiceFace
                key={`${d}-${i}`}
                value={d}
                selected={picked.includes(i) || view.selected?.includes(i)}
                disabled={!myTurn || busy}
                onClick={
                  view.phase === "selecting"
                    ? () => setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))
                    : undefined
                }
              />
            ))}
          </div>
          {typeof view.turnScore === "number" ? (
            <p className="mt-4 text-center text-sm text-muted">
              Turn <span className="tabular-nums text-fg">{view.turnScore}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {view.community?.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {view.community.map((c) => (
            <PlayingCard key={c.id} label={c.label} suit={c.suit} />
          ))}
        </div>
      ) : null}

      {view.trick && view.trick.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {view.trick.map((t) => (
            <PlayingCard key={t.card.id} label={t.card.label} suit={t.card.suit} />
          ))}
        </div>
      ) : null}

      {view.myHand?.length ? (
        <div>
          <p className="mb-2 text-xs text-muted">Your hand</p>
          <div className="flex flex-wrap gap-2">
            {view.myHand.map((c) => {
              const legal = view.legal.some((a) => a.type === "play" && a.payload === c.id);
              const selected = pickedCards.includes(c.id);
              return (
                <PlayingCard
                  key={c.id}
                  label={c.label}
                  suit={c.suit}
                  selected={selected}
                  disabled={!myTurn || busy || (view.phase !== "pass" && !legal)}
                  onClick={() => {
                    if (view.phase === "pass") {
                      setPickedCards((cur) => {
                        if (cur.includes(c.id)) return cur.filter((x) => x !== c.id);
                        if (cur.length >= 3) return cur;
                        return [...cur, c.id];
                      });
                      return;
                    }
                    if (legal) onAction("play", c.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : view.hiddenCounts ? (
        <div className="flex gap-2">
          {Object.keys(view.hiddenCounts).map((id) => (
            <CardBack key={id} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {view.legal.map((action) => (
          <Button
            key={`${action.type}-${String(action.payload)}`}
            variant={action.type === "fold" ? "ghost" : "primary"}
            disabled={busy || !myTurn || Boolean(action.disabledReason)}
            onClick={() => {
              if (action.type === "keep" || action.type === "bank") {
                onAction(action.type, picked.length ? picked : action.payload);
                setPicked([]);
                return;
              }
              if (action.type === "pass" && pickedCards.length === 3) {
                onAction("pass", pickedCards);
                setPickedCards([]);
                return;
              }
              onAction(action.type, action.payload);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {!myTurn && !view.terminal ? (
        <p className="text-center text-sm text-muted">Waiting on the house.</p>
      ) : null}

      <ol className={cn("grid gap-1 text-sm text-muted")}>
        {view.eventLog.slice(-8).map((e, i) => (
          <li key={`${e}-${i}`}>{e}</li>
        ))}
      </ol>
    </div>
  );
}

function ScoreStrip({ view }: { view: GameView }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {view.seats.map((seat) => (
        <li
          key={seat.id}
          className={cn(
            "rounded-full border px-3 py-1 text-xs tabular-nums",
            view.toAct === seat.id ? "border-accent text-fg" : "border-border text-muted",
          )}
        >
          {seat.name}
          {view.scores[seat.id] !== undefined ? ` · ${view.scores[seat.id]}` : ""}
        </li>
      ))}
    </ul>
  );
}
