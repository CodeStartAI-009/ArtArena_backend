const { nanoid } = require("nanoid");
const Room = require("../models/Room");

module.exports = (io, socket, rooms) => {

  socket.on("PLAY_PUBLIC", async () => {
    // 🔍 Find existing public room that is joinable
    let room = [...rooms.values()].find(r =>
      r.type === "public" &&
      r.mode === "Quick" &&
      r.gameplay === "Timer" &&
      r.status === "lobby" &&
      r.players.length < r.maxPlayers
    );

    // 🏗️ Create new room if none found
    if (!room) {
      const code = nanoid(6).toUpperCase();

      room = {
        code,
        type: "public",
        mode: "Quick",
        gameplay: "Timer",
        timer: 30,
        totalRounds: 5,
        maxPlayers: 12,
        minPlayers: 4,

        status: "lobby",
        players: [],
        round: 0,
        drawerIndex: 0,
        guessingAllowed: false,

        drawing: [],
        undoStack: [],
        rematch: null,
        __rooms: rooms,
      };

      rooms.set(code, room);

      await Room.create({
        code,
        type: "public",
        mode: "Quick",
        gameplay: "Timer",
        timer: 30,
        totalRounds: 5,
        maxPlayers: 12,
      });

      console.log(`🌍 Public room created → ${code}`);
    }

    socket.emit("MATCH_FOUND", { code: room.code });
  });
};
