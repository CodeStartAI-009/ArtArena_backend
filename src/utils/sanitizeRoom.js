// backend/utils/sanitizeRoom.js
module.exports = function sanitizeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    gameplay: room.gameplay,
    theme: room.theme,
    maxPlayers: room.maxPlayers,
    status: room.status,
    locked: room.locked,
    isPublic: room.isPublic,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      connected: p.connected,
      score: p.score,
    })),
  };
};
