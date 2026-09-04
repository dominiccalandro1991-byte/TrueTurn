/**
 * Authoritative WebSocket scaffold for TrueTurn.
 * Phase 1 preview uses TanStack server functions on the web origin instead.
 * This process is the scale-out target: one match coordinator per process,
 * no Raft. Do not treat this file as a deployed consensus cluster.
 */
import { createServer } from "node:http";

const port = Number(process.env.TRUETURN_WS_PORT ?? 8787);

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "trueturn-match", raft: false }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TrueTurn match health on :${port} (WebSocket protocol documented in docs/API.md)`);
});
