const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");
const emitGameState = require("../utils/emitGameState");

/* =========================
   START GAME
========================= */
function startGame(io, room) {
  if (!room) return;

  /* =========================
     TOGETHER MODE
  ========================== */
  if (room.mode === "Together") {
    if (room.players.length !== 2) {
      io.to(room.code).emit("FORCE_EXIT");
      return;
    }

    room.players[0].side = "left";
    room.players[1].side = "right";
    room.status = "playing";

    emitGameState(io, room);

    io.to(room.code).emit("TOGETHER_STARTED", {
      leftPlayerId: room.players[0].id,
      rightPlayerId: room.players[1].id,
    });

    return;
  }

  /* =========================
     NORMAL GAME START
  ========================== */
  room.status = "playing";
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

  require("./roundEngine").startRound(io, room);
}

/* =========================
   GAME END RULES
========================= */
function shouldEndGame(room) {
  if (!room || room.status !== "playing") return false;

  // Together mode never auto-ends
  if (room.mode === "Together") return false;

  const playersCount = room.players.length;

  /**
   * A round is considered COMPLETE only when
   * drawerIndex is back to 0 (everyone drew once)
   */
  const roundCompleted = room.drawerIndex === 0;

  if (!roundCompleted) return false;

  // ✅ SCORE LIMIT (checked ONLY after full round)
  if (typeof room.maxScore === "number") {
    const maxScoreReached = room.players.some(
      p => p.score >= room.maxScore
    );

    if (maxScoreReached) {
      console.log("🏁 End game: max score reached after full round");
      return true;
    }
  }

  // ✅ ROUND LIMIT (checked ONLY after full round)
  if (
    typeof room.totalRounds === "number" &&
    room.round > room.totalRounds
  ) {
    console.log("🏁 End game: max rounds completed");
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

  /* ---------- Stop timers ---------- */
  clearTimeout(room.mainTimer);
  clearTimeout(room.lastChanceTimer);
  room.mainTimer = null;
  room.lastChanceTimer = null;

  /* ---------- Determine winner ---------- */
  const winner =
    room.players.length > 0
      ? [...room.players].sort((a, b) => b.score - a.score)[0]
      : null;

  console.log(
    `🏁 Game ended (${reason}) → Winner: ${winner?.username ?? "N/A"}`
  );

  /* ---------- Freeze gameplay ---------- */
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

  /* ---------- Auto cleanup ---------- */
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

  // Rematch is only valid for private rooms
  if (room.type !== "private") {
    io.to(room.code).emit("FORCE_EXIT");
    return;
  }

  console.log(`🔁 Rematch starting → ${room.code}`);

  /* =========================
     Collect players who voted PLAY
  ========================== */
  const playIds = new Set(
    [...room.rematch.votes.entries()]
      .filter(([, vote]) => vote === "play")
      .map(([userId]) => userId)
  );

  /* =========================
     Keep only eligible players
  ========================== */
  room.players = room.players.filter(
    p => playIds.has(p.id) && p.connected !== false
  );

  /* =========================
     Need at least 2 players
  ========================== */
  if (room.players.length < 2) {
    io.to(room.code).emit("FORCE_EXIT");

    scheduleRoomCleanup(room.code, room.__rooms);
    return;
  }

  /* =========================
     Reset game state
  ========================== */
  room.status = "playing";
  room.round = 1;
  room.drawerIndex = 0;
  room.drawerId = null;

  room.phase = null;
  room.guessingAllowed = false;
  room.currentWord = null;
  room.wordChoices = null;
  room.revealedLetters = [];
  room.correctGuessers = new Set();
  room.turnEnded = false;
  room.revealsDone = 0;
  room.hasDrawn = false;

  room.drawing = [];
  room.undoStack = [];

  room.rematch = null;

  /* =========================
     Reset players
  ========================== */
  room.players.forEach(p => {
    p.score = 0;
    p.guessedCorrectly = false;
    p.connected = true;
  });

  /* =========================
     Notify clients
  ========================== */
  io.to(room.code).emit("REMATCH_STARTED");

  /* =========================
     Start fresh game loop
  ========================== */
  require("./roundEngine").startRound(io, room);
}

function applyScore(io, room, userId) {
  const player = room.players.find(p => p.id === userId);
  if (!player) return;

  io.to(room.code).emit("SCORE_UPDATED", {
    userId,
    score: player.score,
  });
}

/* =========================
   EXPORTS (SINGLE SOURCE)
========================= */
module.exports = {
  startGame,
  shouldEndGame,
  endGame,
  startRematch,
  applyScore,
};
