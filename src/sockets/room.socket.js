 // backend/src/sockets/room.socket.js

const Room = require("../models/Room");
const User = require("../models/User");
const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");

module.exports = (io, socket, rooms) => {

  /* =========================
     LOBBY JOIN
  ========================== */
  socket.on("LOBBY_JOIN", async ({ code }) => {
    const userId = socket.data.userId;
    if (!code || !userId) {
      console.warn("❌ LOBBY_JOIN blocked", { code, userId });
      return;
    }

    let room = rooms.get(code);

    /* ---------- HYDRATE ROOM FROM DB ---------- */
    if (!room) {
      const dbRoom = await Room.findOne({ code }).lean();
      if (!dbRoom) {
        console.warn("❌ Room not found in DB:", code);
        return;
      }

      /* ✅ SAFE TIMER NORMALIZATION */
      let timer = null;
      if (dbRoom.gameplay === "Timer") {
        const parsed = Number(dbRoom.timer);
        timer = Number.isFinite(parsed) ? parsed : null;
      }

      room = {
        code: dbRoom.code,
        type: dbRoom.type,
        mode: dbRoom.mode,
        gameplay: dbRoom.gameplay,
        theme: dbRoom.theme,
        maxPlayers: dbRoom.maxPlayers,
        maxScore: dbRoom.maxScore ?? null,
        totalRounds: dbRoom.totalRounds ?? null,
        timer, // ✅ ALWAYS NUMBER OR NULL
        status: "lobby",
        hostId: null,
        players: [],
        __rooms: rooms,
      };

      rooms.set(code, room);

      console.log("🏠 ROOM HYDRATED FROM DB", {
        code: room.code,
        type: room.type,
        mode: room.mode,
        gameplay: room.gameplay,
        timer: room.timer,
        maxScore: room.maxScore,
        totalRounds: room.totalRounds,
        maxPlayers: room.maxPlayers,
      });
    }

    /* ---------- FETCH USER ---------- */
    const dbUser = await User.findById(userId).lean();
    if (!dbUser) {
      console.warn("❌ User not found:", userId);
      return;
    }

    /* ---------- MAX PLAYERS CHECK ---------- */
    const connectedCount = room.players.filter(p => p.connected).length;
    if (
      room.maxPlayers &&
      connectedCount >= room.maxPlayers &&
      !room.players.some(p => String(p.id) === String(userId))
    ) {
      socket.emit("ROOM_FULL");
      return;
    }

    /* ---------- ADD / RECONNECT PLAYER ---------- */
    let player = room.players.find(
      p => String(p.id) === String(userId)
    );

    if (!player) {
      player = {
        id: userId,
        username: dbUser.username,
        socketId: socket.id,
        connected: true,
      };

      room.players.push(player);

      if (!room.hostId) {
        room.hostId = userId;
      }

      console.log("➕ PLAYER JOINED ROOM", {
        roomCode: room.code,
        roomType: room.type,
        username: dbUser.username,
        playersNow: room.players.length,
      });
    } else {
      player.socketId = socket.id;
      player.connected = true;
      player.username = dbUser.username;

      console.log("🔁 PLAYER RECONNECTED", {
        roomCode: room.code,
        username: dbUser.username,
      });
    }

    /* ---------- JOIN SOCKET ROOM ---------- */
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

    const player = room.players.find(
      p => p.socketId === socket.id
    );
    if (!player) return;

    player.connected = false;

    console.log("🔴 PLAYER DISCONNECTED", {
      roomCode: room.code,
      username: player.username,
      roomType: room.type,
    });

    io.to(code).emit("LOBBY_UPDATE", snapshot(room));

    if (
      room.type === "private" &&
      room.players.every(p => !p.connected)
    ) {
      console.log("🧹 Scheduling cleanup for private room", {
        roomCode: room.code,
      });
      scheduleRoomCleanup(code, rooms);
    }
  });
};

/* =========================
   SNAPSHOT (CLIENT SAFE)
========================= */
function snapshot(room) {
  return {
    code: room.code,
    type: room.type,
    mode: room.mode,
    gameplay: room.gameplay,
    theme: room.theme,
    timer: room.timer, // ✅ number or null
    maxPlayers: room.maxPlayers,
    maxScore: room.maxScore ?? null,
    totalRounds: room.totalRounds ?? null,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      connected: p.connected,
    })),
  };
}
