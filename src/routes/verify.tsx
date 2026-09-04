import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TEST_VECTORS } from "../../packages/provably-fair/src/vectors.ts";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { verifyFn } from "@/lib/platform/api";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/verify")({ component: VerifyPage });

function VerifyPage() {
  const { tokens, diamonds } = usePlatform();
  const [serverSeedHex, setServer] = useState(TEST_VECTORS.serverSeedHex);
  const [clientSeedHex, setClient] = useState(TEST_VECTORS.clientSeedHex);
  const [commitmentHex, setCommit] = useState<string>(TEST_VECTORS.expected.commitment);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const out = await verifyFn({
        data: {
          serverSeedHex,
          clientSeedHex,
          commitmentHex,
          nonce,
          kind: "dice",
          dieCount: 6,
        },
      });
      setResult(`${out.message} Dice: ${(out as { dice?: number[] }).dice?.join("–") ?? "—"}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <h1 className="font-display text-4xl tracking-tight">Verify a roll</h1>
      <p className="mt-2 max-w-xl text-muted">
        Commitment is SHA-256 of the server seed. Dice are rejection-sampled from HMAC-SHA256(server, client ∥ nonce ∥
        block). The fields below load the public test vector.
      </p>
      <form className="mt-6 grid gap-3">
        <Field label="Server seed (hex)" value={serverSeedHex} onChange={setServer} />
        <Field label="Client seed (hex)" value={clientSeedHex} onChange={setClient} />
        <Field label="Commitment" value={commitmentHex} onChange={setCommit} />
        <label className="grid gap-1 text-sm">
          Nonce
          <input
            className="min-h-11 rounded-[var(--radius-md)] border border-border bg-surface px-3 font-mono text-sm"
            type="number"
            min={0}
            value={nonce}
            onChange={(e) => setNonce(Number(e.target.value))}
          />
        </label>
        <Button type="button" disabled={busy} onClick={run}>
          {busy ? "Checking…" : "Reproduce dice"}
        </Button>
      </form>
      {result ? <p className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">{result}</p> : null}
    </Shell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <textarea
        className="min-h-20 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
      />
    </label>
  );
}
