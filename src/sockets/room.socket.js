// backend/src/sockets/room.socket.js

const Room = require("../models/Room");
const cleanupRoom = require("../utils/cleanupRoom");

/* =========================
   CLEANUP SCHEDULER
========================= */
function scheduleRoomCleanup(code, rooms) {
  const room = rooms.get(code);
  if (!room) return;

  if (room.type !== "private") return;
  if (room.status === "playing" || room.status === "starting") return;
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
  }, 30_000);
}

/* =========================
   SOCKET HANDLER
========================= */
module.exports = (io, socket, rooms) => {

  /* =========================
     LOBBY JOIN (LAZY HYDRATE)
  ========================== */
  socket.on("LOBBY_JOIN", async ({ code, user }) => {
    if (!code || !user?.id || !user?.username) return;

    let room = rooms.get(code);

    /* ---------- LAZY HYDRATE FROM DB ---------- */
    if (!room) {
      const dbRoom = await Room.findOne({ code }).lean();
      if (!dbRoom) return;

      /* =========================
         🔒 NORMALIZATION (CRITICAL)
      ========================== */
      let timer = Number(dbRoom.timer);
      if (!Number.isFinite(timer) || timer <= 0) {
        timer = 30; // ✅ safe default
      }

      let totalRounds = Number(dbRoom.totalRounds);
      if (!Number.isFinite(totalRounds) || totalRounds <= 0) {
        totalRounds = null;
      }

      let maxScore = Number(dbRoom.maxScore);
      if (!Number.isFinite(maxScore) || maxScore <= 0) {
        maxScore = null;
      }

      let maxPlayers = Number(dbRoom.maxPlayers);
      if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) {
        maxPlayers = 4;
      }

      room = {
        /* ---------- Persistent ---------- */
        code,
        type: dbRoom.type ?? "private",
        mode: dbRoom.mode,
        gameplay: dbRoom.gameplay,
        theme: dbRoom.theme,
        maxPlayers,
        totalRounds,
        maxScore,
        timer, // ✅ ALWAYS NUMBER

        /* ---------- Runtime ---------- */
        status: "lobby", // lobby | starting | playing | ended
        locked: false,
        hostId: null,

        players: [],
        round: 0,
        drawerIndex: 0,
        drawerId: null,
        guessingAllowed: false,

        drawing: [],
        undoStack: [],

        rematch: {
          active: false,
          votes: new Map(),
        },

        cleanupTimer: null,
        __rooms: rooms,
      };

      rooms.set(code, room);

      console.log(
        `🏠 ROOM HYDRATED → ${code}
         ▸ Type: ${room.type}
         ▸ Mode: ${room.mode}
         ▸ Gameplay: ${room.gameplay}
         ▸ Max Players: ${room.maxPlayers}
         ▸ Total Rounds: ${room.totalRounds ?? "∞"}
         ▸ Max Score: ${room.maxScore ?? "N/A"}
         ▸ Timer: ${room.timer} sec
         ▸ Theme: ${room.theme}`
      );
    }

    const userId = String(user.id);
    let player = room.players.find(p => p.id === userId);

    /* ---------- ROOM FULL CHECK ---------- */
    if (!player && room.players.length >= room.maxPlayers) {
      socket.emit("ROOM_FULL", { maxPlayers: room.maxPlayers });
      return;
    }

    socket.join(code);

    /* ---------- CANCEL CLEANUP ---------- */
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }

    /* ---------- RECONNECT ---------- */
    if (player) {
      player.socketId = socket.id;
      player.connected = true;
    }
    /* ---------- NEW PLAYER ---------- */
    else {
      player = {
        id: userId,
        username: user.username,
        socketId: socket.id,
        connected: true,
        score: 0,
        guessedCorrectly: false,
      };

      room.players.push(player);

      if (!room.hostId) {
        room.hostId = userId;
      }

      console.log(`➕ Player joined: ${user.username}`);
    }

    /* ---------- BROADCAST LOBBY ---------- */
    io.to(code).emit("LOBBY_UPDATE", {
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
    });
  });

  /* =========================
     SOCKET DISCONNECT
  ========================== */
  socket.on("disconnect", () => {
    rooms.forEach(room => {
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.connected = false;

      io.to(room.code).emit("LOBBY_UPDATE", {
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
      });

      if (
        room.type === "private" &&
        room.status !== "playing" &&
        room.status !== "starting" &&
        room.players.every(p => p.connected === false)
      ) {
        scheduleRoomCleanup(room.code, rooms);
      }
    });
  });
};
