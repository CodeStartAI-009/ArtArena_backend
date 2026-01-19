const gameEngine = require("../engine/gameEngine");
const emitGameState = require("../utils/emitGameState");

module.exports = (io, socket, rooms) => {

  socket.on("REMATCH_DECISION", ({ code, decision }) => {
    const room = rooms.get(code);
    if (!room || !room.rematch?.active) return;

    const userId = socket.userId;
    if (!userId) return;

    if (!["play", "exit"].includes(decision)) return;

    room.rematch.votes.set(userId, decision);

    // 🔁 Broadcast vote status (optional UI)
    io.to(code).emit("REMATCH_UPDATE", {
      votes: Array.from(room.rematch.votes.entries()),
    });

    checkRematch(io, room);
  });
};

/* =========================
   REMATCH RESOLUTION
========================= */
function checkRematch(io, room) {
  const playAgainPlayers = room.players.filter(p =>
    room.rematch.votes.get(p.id) === "play"
  );

  // ❌ Not enough players
  if (playAgainPlayers.length < 2) return;

  // ✅ Start rematch
  startRematch(io, room, playAgainPlayers);
}

function startRematch(io, room, players) {
  console.log(`🔁 Rematch starting with ${players.length} players`);

  // Remove exited players
  room.players = players;

  // Reset room state
  room.status = "lobby";
  room.round = 0;
  room.drawerId = null;
  room.drawerIndex = 0;
  room.currentWord = null;
  room.wordChoices = null;
  room.guessingAllowed = false;
  room.timer = null;
  room.drawing = [];
  room.undoStack = [];
  room.revealedLetters = [];

  room.players.forEach(p => {
    p.score = 0;
    p.guessedCorrectly = false;
  });

  delete room.rematch;

  emitGameState(io, room);

  io.to(room.code).emit("REMATCH_STARTED");
}
