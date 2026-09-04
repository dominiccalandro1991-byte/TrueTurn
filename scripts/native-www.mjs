#!/usr/bin/env node
/**
 * Prepare native/www for Capacitor.
 * The club itself is SSR (TanStack Start). Store binaries should set
 * TRUETURN_NATIVE_URL to the hosted origin. This folder is the launcher shell.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dest = join(root, "native", "www");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

const favicon = join(root, "public", "favicon.svg");
if (existsSync(favicon)) copyFileSync(favicon, join(dest, "favicon.svg"));

writeFileSync(
  join(dest, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#090a0c">
  <link rel="icon" href="./favicon.svg">
  <title>TrueTurn</title>
  <style>
    :root { color-scheme: dark; }
    html,body { margin:0; min-height:100%; background:#090a0c; color:#ece8df; font-family: Outfit, ui-sans-serif, system-ui, sans-serif; }
    main { min-height:100dvh; display:grid; place-items:center; padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom)); text-align:center; }
    h1 { font-family: Fraunces, Georgia, serif; font-weight:500; font-size:2.4rem; letter-spacing:-0.03em; margin:0 0 12px; }
    p { max-width:28rem; margin:0 auto 10px; color:#9b958c; line-height:1.5; }
    .chip { display:inline-block; border:1px solid rgba(236,232,223,.12); border-radius:999px; padding:6px 12px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#6f6a63; }
  </style>
</head>
<body>
  <main>
    <p class="chip">Virtual club</p>
    <h1>TrueTurn</h1>
    <p>The table does not blink. Eight games. Every roll committed before it lands. Tokens are not money.</p>
    <p>This native shell is store-ready. Point <code>TRUETURN_NATIVE_URL</code> at your hosted club, then archive in Xcode or upload an AAB.</p>
  </main>
</body>
</html>
`,
);
console.log(`[native-www] launcher ready at ${dest}`);
