const gameEngine = require("../engine/gameEngine");
const roundEngine = require("../engine/roundEngine");
const scoringEngine = require("../engine/scoringEngine");
const emitGameState = require("../utils/emitGameState");
const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");

module.exports = (io, socket, rooms) => {

  /* =========================
     START GAME (PRIVATE / HOST)
  ========================== */
  socket.on("START_GAME", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.status !== "lobby") return;
    if (room.players.length < 2) return;

    room.status = "starting";
    io.to(code).emit("GAME_STARTING");

    setTimeout(() => {
      if (room.status !== "starting") return;
      gameEngine.startGame(io, room);
      io.to(code).emit("GAME_STARTED", { code });
      emitGameState(io, room);
    }, 3000);
  });

  /* =========================
     GAME JOIN / RECONNECT
  ========================== */
  socket.on("GAME_JOIN", ({ code, userId }) => {
    const room = rooms.get(code);
    if (!room || !userId) return;

    socket.userId = userId;
    socket.join(code);

    const player = room.players.find(p => p.id === userId);
    if (player) {
      player.connected = true;
      player.socketId = socket.id;
    }

    emitGameState(io, room);

    if (room.wordChoices && room.drawerId === userId) {
      socket.emit("WORD_CHOICES", room.wordChoices);
    }

    if (room.drawing?.length) {
      socket.emit("DRAW_SYNC", room.drawing);
    }
  });

  /* =========================
     WORD SELECTION
  ========================== */
  socket.on("SELECT_WORD", ({ code, word }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.drawerId !== socket.userId) return;
    if (!room.wordChoices?.includes(word)) return;

    room.currentWord = word;
    room.wordChoices = null;
    room.revealedLetters = [];

    io.to(code).emit("WORD_SELECTED", { wordLength: word.length });
    emitGameState(io, room);
  });

  /* =========================
     ALLOW GUESSING
  ========================== */
  socket.on("ALLOW_GUESSING", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.drawerId !== socket.userId) return;
    if (room.guessingAllowed) return;
    if (room.status !== "playing") return;

    roundEngine.allowGuessing(io, room);
    emitGameState(io, room);
  });

  /* =========================
     GUESS
  ========================== */
  socket.on("GUESS", ({ code, guess }) => {
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;
    if (!room.guessingAllowed || !room.currentWord) return;

    const normalized = guess?.trim().toLowerCase();
    if (!normalized) return;

    const correct = normalized === room.currentWord.toLowerCase();
    roundEngine.onAnyGuess(io, room, socket.userId, correct);

    if (!correct) {
      io.to(code).emit("WRONG_GUESS", {
        userId: socket.userId,
        guess: normalized,
      });
      emitGameState(io, room);
      return;
    }

    if (!scoringEngine.awardScore(room, socket.userId)) return;

    io.to(code).emit("CORRECT_GUESS", { userId: socket.userId });
    emitGameState(io, room);
  });

  /* =========================
     🌍 PUBLIC MATCHMAKING (FIXED)
  ========================== */
  socket.on("PLAY_PUBLIC", () => {
    if (!socket.userId) {
      console.log("❌ PLAY_PUBLIC blocked: socket not authenticated");
      return;
    }

    console.log("🎮 PLAY_PUBLIC from", socket.userId);

    let room = [...rooms.values()].find(r =>
      r.type === "public" &&
      r.status === "lobby" &&
      r.mode === "Quick" &&
      r.gameplay === "Timer" &&
      r.players.length < r.maxPlayers
    );

    if (!room) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      room = {
        code,
        type: "public",
        mode: "Quick",
        gameplay: "Timer",
        theme: "random",
        maxPlayers: 12,
        totalRounds: 5,
        timer: 30,
        status: "lobby",
        hostId: socket.userId,
        players: [],
        round: 0,
        drawerIndex: 0,
        drawerId: null,
        guessingAllowed: false,
        drawing: [],
        undoStack: [],
        rematch: null,
        cleanupTimer: null,
        __rooms: rooms,
      };

      rooms.set(code, room);
      console.log(`🌍 PUBLIC ROOM CREATED → ${code}`);
    }

    const existing = room.players.find(p => p.id === socket.userId);
    if (existing) {
      existing.connected = true;
      existing.socketId = socket.id;
      socket.join(room.code);
      socket.emit("MATCH_FOUND", { code: room.code });
      return;
    }

    socket.join(room.code);

    room.players.push({
      id: socket.userId,
      username: socket.username,
      socketId: socket.id,
      connected: true,
      score: 0,
      xp: 0,
      coins: 0,
      gems: 0,
    });

    console.log(`➕ Joined public room ${room.code}`);

    socket.emit("MATCH_FOUND", { code: room.code });

    if (room.players.length >= 4 && room.status === "lobby") {
      room.status = "starting";
      io.to(room.code).emit("GAME_STARTING");

      setTimeout(() => {
        if (room.status !== "starting") return;
        gameEngine.startGame(io, room);
        io.to(room.code).emit("GAME_STARTED", { code: room.code });
      }, 3000);
    }
  });

  /* =========================
     EXIT / DISCONNECT
  ========================== */
  socket.on("GAME_EXIT", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.userId);
    if (player) player.connected = false;

    emitGameState(io, room);

    if (room.type === "private" &&
        room.players.every(p => !p.connected)) {
      scheduleRoomCleanup(room.code, rooms);
    }
  });

  socket.on("disconnect", () => {
    rooms.forEach(room => {
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.connected = false;
      emitGameState(io, room);

      if (room.type === "private" &&
          room.players.every(p => !p.connected)) {
        scheduleRoomCleanup(room.code, rooms);
      }
    });
  });
};
