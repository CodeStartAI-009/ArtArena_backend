// backend/src/utils/emitGameState.js
module.exports = function emitGameState(io, room) {
  if (!room) return;

  for (const player of room.players) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit("GAME_STATE", {
      code: room.code,
      mode: room.mode,
      gameplay: room.gameplay,
      status: room.status,
      round: room.round,
      drawerId: room.drawerId,
      guessingAllowed: room.guessingAllowed,
      wordLength: room.currentWord?.length ?? 0,
      revealedLetters: room.revealedLetters ?? [],
      selfId: player.id,
      players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        score: p.score ?? 0,
        guessedCorrectly: p.guessedCorrectly ?? false,
        connected: p.connected !== false
      })),
      drawing: room.drawing ?? [],
    });
    
  }
};
