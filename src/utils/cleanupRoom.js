function cleanupRoom(room) {
    if (!room || !room.__rooms) return;
  
    console.log(`🧹 Cleaning up room ${room.code}`);
  
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
    }
  
    room.__rooms.delete(room.code);
  }
  
  module.exports = cleanupRoom;
  