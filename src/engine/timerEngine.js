/* =========================
   TIMER ENGINE (AUTHORITATIVE)
========================= */

function getValidSeconds(room) {
  const raw = Number(room.timer);

  // Fallback safety (never NaN)
  if (!Number.isFinite(raw) || raw <= 0) {
    return 30; // default safe value
  }

  return Math.floor(raw);
}

/* =========================
   MAIN ROUND TIMER
========================= */
function startMainTimer(io, room) {
  if (!room) return;

  // 🔒 Use room-configured timer
  let seconds = getValidSeconds(room);

  room.remainingTime = seconds;

  io.to(room.code).emit("TIMER_START", { seconds });

  room.mainTimer = setInterval(() => {
    seconds--;
    room.remainingTime = seconds;

    io.to(room.code).emit("TIMER_TICK", { seconds });

    if (seconds <= 0) {
      stopAllTimers(room);

      // Lazy require to avoid circular deps
      const { endTurn } = require("./roundEngine");
      endTurn(io, room);
    }
  }, 1000);
}

/* =========================
   LAST CHANCE TIMER (20s)
========================= */
function startLastChanceTimer(io, room) {
  if (!room) return;

  let seconds = 20;

  io.to(room.code).emit("LAST_CHANCE_STARTED", { seconds });

  room.lastChanceTimer = setInterval(() => {
    seconds--;

    io.to(room.code).emit("LAST_CHANCE_TICK", { seconds });

    if (seconds <= 0) {
      stopAllTimers(room);

      const { endTurn } = require("./roundEngine");
      endTurn(io, room);
    }
  }, 1000);
}

/* =========================
   STOP ALL TIMERS (SAFE)
========================= */
function stopAllTimers(room) {
  if (!room) return;

  if (room.mainTimer) {
    clearInterval(room.mainTimer);
    room.mainTimer = null;
  }

  if (room.lastChanceTimer) {
    clearInterval(room.lastChanceTimer);
    room.lastChanceTimer = null;
  }
}

module.exports = {
  startMainTimer,
  startLastChanceTimer,
  stopAllTimers,
};
