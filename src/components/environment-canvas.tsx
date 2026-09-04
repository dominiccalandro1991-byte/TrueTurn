import { useEffect, useRef } from "react";
import type { EnvironmentVector } from "../../packages/game-core/src/environment.ts";

const PALETTE: Record<string, [string, string, string]> = {
  volcano: ["#1a0e0c", "#3a1812", "#a8b7c4"],
  subterranean: ["#0c1012", "#1b2422", "#8aa39a"],
  aurora: ["#071018", "#123043", "#a8b7c4"],
  harbor: ["#0c1218", "#1a2833", "#c5c0b4"],
  observatory: ["#07080e", "#16182a", "#d5d0c4"],
  "desert-night": ["#100e0c", "#2a2118", "#a8b7c4"],
};

function hash32(hex: string): number {
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}

export function EnvironmentCanvas({ environment, className }: { environment: EnvironmentVector; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
    const [a, b, star] = PALETTE[environment.location] ?? PALETTE.observatory;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, a!);
    g.addColorStop(1, b!);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    let seed = hash32(environment.entropy);
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    ctx.fillStyle = star!;
    const n = environment.location === "volcano" ? 40 : 90;
    for (let i = 0; i < n; i++) {
      const x = rand() * w;
      const y = rand() * h * 0.7;
      const r = rand() * 1.6 * devicePixelRatio + 0.4;
      ctx.globalAlpha = 0.25 + rand() * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = b!;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.62);
    for (let x = 0; x <= w; x += w / 12) {
      ctx.lineTo(x, h * (0.55 + rand() * 0.2));
    }
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [environment]);
  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
    />
  );
}
