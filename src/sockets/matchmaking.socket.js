const { nanoid } = require("nanoid");
const Room = require("../models/Room");

module.exports = (io, socket, rooms) => {
  socket.on("PLAY_PUBLIC", async () => {
    const userId = socket.data.userId;
    if (!userId) return;

    let room = [...rooms.values()].find(
      r => r.type === "public" && r.status === "lobby"
    );

    if (!room) {
      const code = nanoid(6).toUpperCase();

      room = {
        code,
        type: "public",
        mode: "Quick",
        gameplay: "Timer",
        theme: "classic",
        maxPlayers: 12,
        status: "lobby",
        hostId: null,
        players: [],
        __rooms: rooms,
      };

      rooms.set(code, room);

      await Room.create({
        code,
        type: "public",
        mode: "Quick",
        gameplay: "Timer",
        theme: "classic",
        maxPlayers: 12,
        status: "lobby",
      });

      console.log(`🌍 PUBLIC ROOM CREATED → ${code}`);
    }

    // 🔥 DO NOT TOUCH room.players HERE
    socket.emit("MATCH_FOUND", { code: room.code });
  });
};
