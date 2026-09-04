import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { createAvatarJobFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/avatar")({ component: AvatarPage });

function AvatarPage() {
  const { session, tokens, diamonds } = usePlatform();
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    try {
      const job = await createAvatarJobFn({
        data: {
          playerId: session.playerId,
          consent,
          bytes: file.size,
          type: file.type,
        },
      });
      setStatus(`Mock adapter complete. Mesh ${job.meshId}. No biometric profile is stored.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload rejected");
    }
  }

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <h1 className="font-display text-4xl tracking-tight">Avatar</h1>
      <p className="mt-2 max-w-xl text-muted">
        Image ingestion is a mock. Nothing is sent to a paid model. Files are validated then discarded. This is not
        facial recognition or identity verification.
      </p>
      <form className="mt-6 grid max-w-lg gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4">
        <label className="grid gap-2 text-sm">
          Face still (JPEG, PNG, or WebP · 4MB)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          I consent to a one-time, user-controlled avatar job. The still may be processed only for this mock mesh and
          must not be retained as biometrics.
        </label>
        <Button type="button" disabled={!consent || !file} onClick={submit}>
          Run mock job
        </Button>
      </form>
      {status ? <p className="mt-4 text-sm text-muted">{status}</p> : null}
    </Shell>
  );
}
