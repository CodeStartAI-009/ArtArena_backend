const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");
const emitGameState = require("../utils/emitGameState");
const roundEngine = require("./roundEngine");

/* =========================
   CONSTANTS
========================= */
const TOGETHER_DURATION = 5 * 60 * 1000; // 5 minutes

/* =========================
   START GAME
========================= */
function startGame(io, room) {
  if (!room) return;

  /* =========================
     TOGETHER MODE
  ========================== */
  if (room.mode === "Together") {
    if (!Array.isArray(room.players) || room.players.length !== 2) {
      console.log("❌ Together mode start failed: invalid player count");

      io.to(room.code).emit("FORCE_EXIT", {
        reason: "Together mode requires exactly 2 players",
      });

      room.status = "ended";
      room.endedAt = Date.now();
      return;
    }

    // Assign sides
    room.players[0].side = "left";
    room.players[1].side = "right";

    room.status = "playing";
    room.startedAt = Date.now();

    emitGameState(io, room);

    io.to(room.code).emit("TOGETHER_STARTED", {
      leftPlayerId: room.players[0].id,
      rightPlayerId: room.players[1].id,
      durationMs: TOGETHER_DURATION,
    });

    console.log(`🎨 Together game started → ${room.code}`);

    /* =========================
       🔑 TOGETHER MODE TIMER
    ========================== */
    room.togetherTimer = setTimeout(() => {
      if (room.status !== "playing") return;

      console.log("⏱️ Together mode time limit reached");
      endGame(io, room, "time_up");
    }, TOGETHER_DURATION);

    return;
  }

  /* =========================
     NORMAL GAME MODES
  ========================== */
  room.status = "playing";
  room.startedAt = Date.now();

  room.round = 1;
  room.drawerIndex = 0;
  room.drawerId = null;

  room.players.forEach(p => {
    p.score = typeof p.score === "number" ? p.score : 0;
    p.guessedCorrectly = false;
    p.connected = p.connected !== false;
  });

  room.rematch = null;

  console.log(`🎮 Game started → ${room.code}`);

  roundEngine.startRound(io, room);
}

/* =========================
   GAME END RULES
========================= */
function shouldEndGame(room) {
  if (!room || room.status !== "playing") return false;

  // ❌ Together mode does NOT use this
  if (room.mode === "Together") return false;

  const playersCount = room.players.length;

  const isLastDrawerOfRound =
    room.drawerIndex === playersCount - 1;

  if (!isLastDrawerOfRound) return false;

  if (typeof room.maxScore === "number") {
    if (room.players.some(p => p.score >= room.maxScore)) {
      return true;
    }
  }

  if (
    typeof room.totalRounds === "number" &&
    room.round >= room.totalRounds
  ) {
    return true;
  }

  return false;
}

/* =========================
   END GAME
========================= */
function endGame(io, room, reason = "completed") {
  if (!room || room.status === "ended") return;

  room.status = "ended";
  room.endedAt = Date.now();

  /* ---------- Clear timers ---------- */
  clearTimeout(room.mainTimer);
  clearTimeout(room.lastChanceTimer);
  clearTimeout(room.togetherTimer);

  room.mainTimer = null;
  room.lastChanceTimer = null;
  room.togetherTimer = null;

  /* ---------- Winner ---------- */
  const winner =
    room.players.length > 0
      ? [...room.players].sort((a, b) => b.score - a.score)[0]
      : null;

  console.log(
    `🏁 Game ended (${reason}) → Winner: ${winner?.username ?? "N/A"}`
  );

  /* ---------- Freeze game ---------- */
  room.guessingAllowed = false;
  room.currentWord = null;
  room.wordChoices = null;
  room.drawing = [];
  room.undoStack = [];

  /* ---------- Rematch ---------- */
  room.rematch = {
    active: true,
    votes: new Map(),
  };

  io.to(room.code).emit("GAME_ENDED", {
    reason,
    winner: winner
      ? {
          id: winner.id,
          username: winner.username,
          score: winner.score,
        }
      : null,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      score: p.score,
      connected: p.connected !== false,
    })),
  });

  io.to(room.code).emit("REMATCH_PROMPT");

  /* ---------- Cleanup ---------- */
  const connectedPlayers = room.players.filter(p => p.connected);
  if (connectedPlayers.length < 2 && room.type === "private") {
    scheduleRoomCleanup(room.code, room.__rooms);
  }
}

/* =========================
   START REMATCH
========================= */
function startRematch(io, room) {
  if (!room?.rematch) return;

  if (room.type !== "private") {
    io.to(room.code).emit("FORCE_EXIT");
    return;
  }

  console.log(`🔁 Rematch starting → ${room.code}`);

  const playIds = new Set(
    [...room.rematch.votes.entries()]
      .filter(([, vote]) => vote === "play")
      .map(([userId]) => userId)
  );

  room.players = room.players.filter(
    p => playIds.has(p.id) && p.connected !== false
  );

  if (room.players.length < 2) {
    io.to(room.code).emit("FORCE_EXIT");
    scheduleRoomCleanup(room.code, room.__rooms);
    return;
  }

  /* ---------- Reset ---------- */
  room.status = "playing";
  room.round = 1;
  room.drawerIndex = 0;
  room.drawerId = null;

  room.players.forEach(p => {
    p.score = 0;
    p.guessedCorrectly = false;
    p.connected = true;
  });

  room.rematch = null;

  io.to(room.code).emit("REMATCH_STARTED");

  roundEngine.startRound(io, room);
}

/* =========================
   SCORE BROADCAST
========================= */
function applyScore(io, room, userId) {
  const player = room.players.find(p => p.id === userId);
  if (!player) return;

  io.to(room.code).emit("SCORE_UPDATED", {
    userId,
    score: player.score,
  });
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  startGame,
  shouldEndGame,
  endGame,
  startRematch,
  applyScore,
};
