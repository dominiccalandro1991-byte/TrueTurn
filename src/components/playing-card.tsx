import { cn } from "@/lib/utils";

export function PlayingCard({
  label,
  suit,
  selected,
  disabled,
  onClick,
  compact,
}: {
  label: string;
  suit: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const red = suit === "hearts" || suit === "diamonds";
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-between rounded-[10px] border bg-fg px-1.5 py-1 font-display shadow-sm transition-transform duration-150",
        compact ? "h-16 w-11" : "h-[4.6rem] w-[3.2rem] sm:h-20 sm:w-14",
        red ? "text-heart" : "text-bg",
        selected ? "ring-2 ring-accent -translate-y-1" : "border-black/10",
        disabled ? "opacity-40" : onClick ? "hover:-translate-y-0.5" : "",
      )}
    >
      <span className="text-xs font-medium leading-none sm:text-sm">{label}</span>
      <span className="text-lg leading-none sm:text-xl">{label.slice(-1)}</span>
    </button>
  );
}

export function CardBack() {
  return (
    <div className="h-16 w-11 rounded-[10px] border border-border bg-raised" aria-hidden>
      <div className="m-1 h-[calc(100%-8px)] rounded-[8px] border border-accent/30" />
    </div>
  );
}
