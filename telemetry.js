/* TrueTurn → Voltcore Command Center. Source slug is forever: trueturn */
(function () {
  var SOURCE = "trueturn";
  var URL = "https://core-api.dominic-calandro1991.workers.dev/api/v1/events";
  var VERSION = "1.0.0";
  var frames = 0;
  var last = typeof performance !== "undefined" ? performance.now() : 0;
  var fps = 0;

  function tick(now) {
    frames += 1;
    if (now - last >= 1000) {
      fps = frames;
      frames = 0;
      last = now;
    }
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick);
  }
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick);

  function emit(type, severity, payload) {
    try {
      fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: SOURCE, type: type, severity: severity, payload: payload }),
        keepalive: true,
      }).catch(function () {});
    } catch (_err) {
      /* never block play */
    }
  }

  function snapshot() {
    var extra = window.__TRUETURN_MATCH || {};
    return {
      status: "live",
      surface: "web",
      version: VERSION,
      frame_rate: fps,
      players_online: Number(window.__TRUETURN_PLAYERS_ONLINE || 0),
      mode: "web",
      match_id: extra.match_id || null,
      game_id: extra.game_id || null,
      table_phase: extra.table_phase || "lobby",
    };
  }

  window.__trueturnEmit = emit;
  window.__TRUETURN_SOURCE = SOURCE;

  setTimeout(function () {
    emit("app.event", "info", { status: "boot", surface: "web", version: VERSION, mode: "web" });
  }, 1600);

  setTimeout(function () {
    emit("health.heartbeat", "info", snapshot());
  }, 2200);

  setInterval(function () {
    emit("health.heartbeat", "info", snapshot());
  }, 30000);

  window.addEventListener("error", function (ev) {
    emit("runtime.error", "high", { message: String((ev && ev.message) || "error"), surface: "web" });
  });
  window.addEventListener("unhandledrejection", function (ev) {
    emit("runtime.error", "high", { message: String((ev && ev.reason) || "rejection"), surface: "web" });
  });
})();
