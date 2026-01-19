// backend/src/utils/emitGameState.js

module.exports = function emitGameState(io, room) {
  if (!room) return;

  const rematchActive = Boolean(room.rematch?.active);
  const rematchVotes = rematchActive
    ? Array.from(room.rematch.votes.entries())
    : [];

  io.to(room.code).emit("GAME_STATE", {
    code: room.code,
    mode: room.mode,
    gameplay: room.gameplay,

    status: room.status,

    round: room.round,
    drawerId: room.drawerId,

    guessingAllowed: room.guessingAllowed,
    timer: room.timer ?? null,

    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      score: p.score ?? 0,
      level: p.level ?? 1,
      xp: p.xp ?? 0,
      coins: p.coins ?? 0,
    })),    

    wordLength: room.currentWord?.length ?? 0,
    revealedLetters: room.revealedLetters ?? [],

    /* =========================
       REMATCH (SAFE)
    ========================= */
    rematch: {
      active: rematchActive,
      votes: rematchVotes,
    },
    revealedLetters: room.revealedLetters ?? [],

  });
  
};
