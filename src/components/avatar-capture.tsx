import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createAvatarJobFn } from "@/lib/platform/api";

function seedFromCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "seed";
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let h = 2166136261;
  for (let i = 0; i < data.length; i += 17) {
    h ^= data[i]!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function AvatarCapture({
  playerId,
  onReady,
}: {
  playerId: string;
  onReady: (meshId: string, seed: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openCam() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setLive(true);
      }
    } catch {
      setError("Camera blocked. A silhouette seed will be used instead.");
    }
  }

  async function instantiate(fromCamera: boolean) {
    if (!consent) return;
    setBusy(true);
    const canvas = canvasRef.current!;
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    if (fromCamera && videoRef.current && live) ctx.drawImage(videoRef.current, 0, 0, 96, 96);
    else {
      ctx.fillStyle = "#12141a";
      ctx.fillRect(0, 0, 96, 96);
    }
    const seed = fromCamera && live ? seedFromCanvas(canvas) : `sil_${playerId.slice(-8)}`;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    try {
      const job = await createAvatarJobFn({
        data: {
          playerId,
          consent: true,
          bytes: blob?.size ?? 1024,
          type: "image/png",
          seed,
        },
      });
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
      onReady(job.meshId, seed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4">
      <p className="text-sm text-muted">One still. We hash it locally into a mesh seed. The photo is discarded.</p>
      <video
        ref={videoRef}
        className={live ? "aspect-square w-full max-w-xs rounded-[var(--radius-lg)] bg-raised object-cover" : "hidden"}
        muted
        playsInline
      />
      <canvas ref={canvasRef} className="hidden" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4" />
        I consent to a one-time avatar job. This is not identity verification.
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-2">
        <Button type="button" variant="ghost" onClick={() => void openCam()}>
          Open camera
        </Button>
        <Button type="button" disabled={!consent || busy || !live} onClick={() => void instantiate(true)}>
          Use this still
        </Button>
        <Button type="button" variant="ghost" disabled={!consent || busy} onClick={() => void instantiate(false)}>
          Skip — use a silhouette
        </Button>
      </div>
    </div>
  );
}
