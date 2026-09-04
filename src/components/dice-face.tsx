import { cn } from "@/lib/utils";

const PIPS: Record<number, string[]> = {
  1: ["c"],
  2: ["tl", "br"],
  3: ["tl", "c", "br"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "c", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};

const POS: Record<string, string> = {
  tl: "left-[18%] top-[18%]",
  tr: "right-[18%] top-[18%]",
  ml: "left-[18%] top-1/2 -translate-y-1/2",
  mr: "right-[18%] top-1/2 -translate-y-1/2",
  bl: "left-[18%] bottom-[18%]",
  br: "right-[18%] bottom-[18%]",
  c: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
};

export function DiceFace({
  value,
  selected,
  onClick,
  disabled,
}: {
  value: number;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const pips = PIPS[value] ?? PIPS[1];
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      aria-label={`Die showing ${value}`}
      aria-pressed={selected}
      className={cn(
        "relative size-16 shrink-0 rounded-[14px] border bg-fg text-bg shadow-sm transition-transform duration-150 sm:size-[4.5rem]",
        selected ? "border-accent ring-2 ring-accent/50 scale-105" : "border-border",
        onClick && !disabled ? "hover:-translate-y-0.5" : "",
      )}
    >
      {pips.map((p) => (
        <span key={p} className={cn("absolute size-2.5 rounded-full bg-bg sm:size-3", POS[p])} />
      ))}
    </button>
  );
}
