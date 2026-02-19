// backend/src/utils/emitGameState.js

module.exports = function emitGameState(io, room) {
  if (!room) return;

  for (const player of room.players) {
    if (!player.socketId) continue;

    /* =========================
       WORD VISIBILITY RULES
    ========================== */

    let currentWord = null;
    let wordLength = 0;

    if (room.mode === "Together") {
      // 🔥 In Together mode BOTH players see the word
      currentWord = room.currentWord ?? null;
    } else {
      // 🔥 In guessing modes only send length
      wordLength = room.currentWord?.length ?? 0;
    }

    io.to(player.socketId).emit("GAME_STATE", {
      /* ================= CORE ROOM INFO ================= */
      code: room.code,
      type: room.type,
      mode: room.mode,
      gameplay: room.gameplay,
      status: room.status,
      theme: room.theme,

      /* ================= ROUND STATE ================= */
      round: room.round,
      drawerId: room.drawerId,
      guessingAllowed: room.guessingAllowed ?? false,

      currentWord,     // 🔥 FIXED
      wordLength,      // 🔥 for guessing modes
      revealedLetters: room.revealedLetters ?? [],

      /* ================= PLAYER CONTEXT ================= */
      selfId: player.id,

      players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        score: p.score ?? 0,
        guessedCorrectly: p.guessedCorrectly ?? false,
        connected: p.connected !== false,
        side: p.side ?? null,
      })),

      /* ================= DRAWING ================= */
      drawing: room.drawing ?? [],
    });
  }
};
