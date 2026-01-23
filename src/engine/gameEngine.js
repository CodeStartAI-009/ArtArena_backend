const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");
const emitGameState = require("../utils/emitGameState");
const { applyRewards } = require("./rewardEngine");

/* =========================
   START GAME
========================= */
function startGame(io, room) {
  if (!room) return;

  if (room.mode === "Together") {
    if (room.players.length !== 2) {
      io.to(room.code).emit("FORCE_EXIT");
      return;
    }

    room.players[0].side = "left";
    room.players[1].side = "right";

    room.status = "playing";

    emitGameState(io, room); // 🔥 BEFORE UI unlock

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

  room.players.forEach(p => {
    p.score = typeof p.score === "number" ? p.score : 0;
    p.guessedCorrectly = false;
    p.connected = p.connected !== false;
  });

  room.rematch = null;

  console.log(`🎮 Game started for room ${room.code}`);

  const { startRound } = require("./roundEngine");
  startRound(io, room);
}

/* =========================
   GAME END RULES (PURE)
========================= */
function shouldEndGame(room) {
  if (!room || room.status !== "playing") return false;

  // Together mode never auto-ends
  if (room.mode === "Together") return false;

  // Score-based
  if (
    room.gameplay === "Score" &&
    typeof room.maxScore === "number"
  ) {
    if (room.players.some(p => p.score >= room.maxScore)) {
      console.log("🏁 End game: max score reached");
      return true;
    }
  }

  // Round-based
  if (
    typeof room.totalRounds === "number" &&
    room.round > room.totalRounds
  ) {
    console.log("🏁 End game: max rounds reached");
    return true;
  }

  return false;
}

/* =========================
   END GAME (AUTHORITATIVE)
========================= */
async function endGame(io, room, reason = "completed") {
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
    `🏆 Game ended (${reason}) → Winner: ${winner?.username ?? "N/A"}`
  );

  /* =========================
     APPLY REWARDS
  ========================== */
  const updatedUsers = [];

  for (const player of room.players) {
    try {
      const result = await applyRewards(player);
      if (!result?.user) continue;

      player.xp = result.user.xp;
      player.level = result.user.level;
      player.coins = result.user.coins;
      player.gems = result.user.gems;

      updatedUsers.push({
        id: player.id,
        xp: player.xp,
        level: player.level,
        coins: player.coins,
        gems: player.gems,
      });

      console.log(
        `🎁 Rewards → ${player.username}: +${result.xpEarned} XP, +${result.coinsEarned} coins`
      );
    } catch (err) {
      console.error(`❌ Reward failed for ${player.username}`, err);
    }
  }

  io.to(room.code).emit("USER_UPDATED", { users: updatedUsers });

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
          level: winner.level,
          xp: winner.xp,
          coins: winner.coins,
        }
      : null,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      score: p.score,
      level: p.level,
      xp: p.xp,
      coins: p.coins,
      gems: p.gems ?? 0,
      connected: p.connected !== false,
    })),
  });

  io.to(room.code).emit("REMATCH_PROMPT");

  const connectedPlayers = room.players.filter(p => p.connected);
  if (connectedPlayers.length < 2) {
    room.rematch.active = false;
    io.to(room.code).emit("FORCE_EXIT");

    if (room.type === "private") {
      scheduleRoomCleanup(room.code, room.__rooms);
    }
  }
}

/* =========================
   START REMATCH
========================= */
function startRematch(io, room) {
  if (!room?.rematch) return;

  console.log(`🔁 Starting rematch for room ${room.code}`);

  const playIds = new Set(
    [...room.rematch.votes.entries()]
      .filter(([, v]) => v === "play")
      .map(([id]) => id)
  );

  room.players = room.players.filter(
    p => playIds.has(p.id) && p.connected !== false
  );

  if (room.players.length < 2) {
    io.to(room.code).emit("FORCE_EXIT");

    if (room.type === "private") {
      scheduleRoomCleanup(room.code, room.__rooms);
    }
    return;
  }

  room.status = "playing";
  room.round = 1;
  room.drawerIndex = 0;
  room.drawerId = null;
  room.guessingAllowed = false;
  room.currentWord = null;
  room.wordChoices = null;
  room.drawing = [];
  room.undoStack = [];
  room.rematch = null;

  room.players.forEach(p => {
    p.score = 0;
    p.guessedCorrectly = false;
    p.connected = true;
  });

  io.to(room.code).emit("REMATCH_STARTED");

  const { startRound } = require("./roundEngine");
  startRound(io, room);
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  startGame,
  shouldEndGame,
  endGame,
  startRematch,
};
