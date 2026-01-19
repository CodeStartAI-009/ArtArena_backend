const cleanupRoom = require("./cleanupRoom");

function scheduleRoomCleanup(code, rooms) {
  if (!rooms || !code) return;

  const room = rooms.get(code);
  if (!room) return;

  // 🔒 Private rooms only
  if (room.type !== "private") return;

  // 🚫 Never cleanup active games
  if (room.status === "playing" || room.status === "starting") return;

  // Prevent duplicate timers
  if (room.cleanupTimer) return;

  room.cleanupTimer = setTimeout(() => {
    const stillEmpty =
      room.players.length === 0 ||
      room.players.every(p => p.connected === false);

    if (stillEmpty) {
      console.log(`🗑️ Auto-deleting private room ${code}`);
      cleanupRoom(code, rooms);
    } else {
      room.cleanupTimer = null;
    }
  }, 30_000); // 30 seconds
}

module.exports = scheduleRoomCleanup;
