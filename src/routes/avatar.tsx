import { createFileRoute, Link } from "@tanstack/react-router";
import { AvatarCapture } from "@/components/avatar-capture";
import { Shell } from "@/components/shell";
import { usePlatform } from "@/lib/platform/use-platform";

export const Route = createFileRoute("/avatar")({ component: AvatarPage });

function AvatarPage() {
  const { session, tokens, diamonds, refresh } = usePlatform();
  return (
    <Shell tokens={tokens} diamonds={diamonds}>
      <h1 className="font-display text-4xl tracking-tight">Avatar</h1>
      <p className="mt-2 max-w-xl text-muted">
        Camera still → local mesh seed. Wardrobe lives in Settings. Nothing is retained as biometrics.
      </p>
      <div className="mt-6 max-w-lg">
        <AvatarCapture playerId={session.playerId} onReady={() => void refresh()} />
      </div>
      <Link to="/settings" className="mt-4 inline-block text-sm text-muted">
        Wardrobe and ledger →
      </Link>
    </Shell>
  );
}
