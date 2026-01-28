const Room = require("../models/Room");
const User = require("../models/User");

module.exports = (io, socket, rooms) => {
  socket.on("LOBBY_JOIN", async ({ code }) => {
    const userId = socket.data.userId;
    if (!code || !userId) return;

    let room = rooms.get(code);

    if (!room) {
      const dbRoom = await Room.findOne({ code }).lean();
      if (!dbRoom) return;

      room = {
        code,
        type: dbRoom.type,
        mode: dbRoom.mode,
        gameplay: dbRoom.gameplay,
        theme: dbRoom.theme,
        maxPlayers: dbRoom.maxPlayers,
        status: "lobby",
        hostId: null,
        players: [],
        __rooms: rooms,
      };

      rooms.set(code, room);
    }

    const dbUser = await User.findById(userId).lean();
    if (!dbUser) return;

    let player = room.players.find(
      p => String(p.id) === String(userId)
    );

    if (!player) {
      player = {
        id: userId,
        username: dbUser.username, // ✅ ALWAYS SET
        socketId: socket.id,
        connected: true,
      };

      room.players.push(player);

      if (!room.hostId) room.hostId = userId;

      console.log(`➕ ${dbUser.username} joined ${room.type} room ${code}`);
    } else {
      // 🔥 REPAIR PLAYER EVERY TIME
      player.socketId = socket.id;
      player.connected = true;
      player.username = dbUser.username;

      console.log(`🔁 ${dbUser.username} reconnected to ${code}`);
    }

    socket.join(code);
    socket.data.roomCode = code;

    io.to(code).emit("LOBBY_UPDATE", snapshot(room));
  });


  /* =========================
     DISCONNECT
  ========================== */
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    player.connected = false;
    io.to(code).emit("LOBBY_UPDATE", snapshot(room));

    if (
      room.type === "private" &&
      room.players.every(p => !p.connected)
    ) {
      console.log(`🧹 Cleaning private room ${code}`);
      cleanupRoom(code, rooms);
    }
  });
};

/* =========================
   SNAPSHOT
========================= */
function snapshot(room) {
  return {
    code: room.code,
    type: room.type,
    mode: room.mode,
    gameplay: room.gameplay,
    theme: room.theme,
    maxPlayers: room.maxPlayers,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      connected: p.connected,
    })),
  };
}
