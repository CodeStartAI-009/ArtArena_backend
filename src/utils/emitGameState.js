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

      selfId: player.id, // 🔥 REQUIRED

      players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        score: p.score ?? 0,
        level: p.level ?? 1,
        xp: p.xp ?? 0,
        coins: p.coins ?? 0,
      })),

      drawing: room.drawing ?? [],
    });
  }
};
