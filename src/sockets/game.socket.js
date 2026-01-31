// backend/src/sockets/game.socket.js

const gameEngine = require("../engine/gameEngine");
const roundEngine = require("../engine/roundEngine");
const scoringEngine = require("../engine/scoringEngine");
const emitGameState = require("../utils/emitGameState");
const { applyRewards } = require("../engine/rewardEngine");
const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");
const User = require("../models/User");

const GUESS_REWARD = { xp: 10, coins: 10 };

/* =========================
   THEMES
========================== */
const THEMES = [
  "classic",
  "forest",
  "desert",
  "space",
  "ice",
  "candy",
  "volcano",
];

function getRandomTheme() {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

module.exports = (io, socket, rooms) => {

  /* =========================
     START GAME
  ========================== */
  socket.on("START_GAME", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.status !== "lobby") return;
    if (room.players.length < 2) return;

    room.status = "starting";
    io.to(code).emit("GAME_STARTING");

    setTimeout(() => {
      if (room.status !== "starting") return;
      gameEngine.startGame(io, room);
      io.to(code).emit("GAME_STARTED", { code });
    }, 3000);
  });

  /* =========================
     GAME JOIN
  ========================== */
  socket.on("GAME_JOIN", ({ code, userId }) => {
    const room = rooms.get(code);
    if (!room || !userId) return;

    socket.userId = userId;
    socket.join(code);

    const player = room.players.find(
      p => String(p.id) === String(userId)
    );

    if (player) {
      player.connected = true;
      player.socketId = socket.id;
    }

    emitGameState(io, room);

    if (room.wordChoices && String(room.drawerId) === String(userId)) {
      socket.emit("WORD_CHOICES", room.wordChoices);
    }
  });

  /* =========================
     WORD SELECTED
  ========================== */
  socket.on("SELECT_WORD", ({ code, word }) => {
    const room = rooms.get(code);
    if (!room || room.turnEnded) return;
    if (String(room.drawerId) !== String(socket.userId)) return;
    if (!room.wordChoices?.includes(word)) return;

    room.currentWord = word;
    room.wordChoices = null;
    room.revealedLetters = [];

    io.to(code).emit("WORD_SELECTED", { wordLength: word.length });
    roundEngine.onWordSelected(io, room);
  });

  /* =========================
     GUESS
  ========================== */
  socket.on("GUESS", async ({ code, guess }) => {
    const room = rooms.get(code);
    if (!room || room.turnEnded) return;
    if (!room.guessingAllowed || !room.currentWord) return;

    const playerId = socket.userId;
    if (!playerId) return;

    if (String(room.drawerId) === String(playerId)) return;

    const player = room.players.find(
      p => String(p.id) === String(playerId)
    );
    if (!player || player.guessedCorrectly) return;

    const normalized = guess?.trim().toLowerCase();
    if (!normalized) return;

    const correct =
      normalized === room.currentWord.toLowerCase();

    if (correct) {
      player.guessedCorrectly = true;
    }

    roundEngine.onAnyGuess(io, room, playerId, correct);

    if (!correct) {
      io.to(code).emit("WRONG_GUESS", {
        userId: playerId,
        guess: normalized,
      });
      return;
    }

    const scored = scoringEngine.awardScore(room, playerId);
    if (!scored) return;

    try {
      const result = await applyRewards(playerId, GUESS_REWARD);
      if (result?.user) {
        io.to(code).emit("USER_UPDATED", {
          users: [{
            id: playerId,
            xp: result.user.xp,
            level: result.user.level,
            coins: result.user.coins,
            gems: result.user.gems ?? 0,
          }],
        });
      }
    } catch (err) {
      console.error("❌ Reward failed:", err);
    }

    io.to(code).emit("CORRECT_GUESS", {
      userId: playerId,
      username: player.username,
    });

    emitGameState(io, room);
  });

  /* =========================
     EXIT / DISCONNECT
  ========================== */
  socket.on("GAME_EXIT", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(
      p => p.id === socket.userId
    );
    if (player) player.connected = false;

    emitGameState(io, room);

    if (
      room.type === "private" &&
      room.players.every(p => !p.connected)
    ) {
      scheduleRoomCleanup(room.code, rooms);
    }
  });

  socket.on("ALLOW_GUESSING", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.turnEnded) return;
    if (room.status !== "playing") return;
    if (String(room.drawerId) !== String(socket.userId)) return;

    roundEngine.allowGuessing(io, room);
  });

  /* =========================
     PUBLIC MATCHMAKING
  ========================== */
  socket.on("PLAY_PUBLIC", async () => {
    if (!socket.userId) return;

    const dbUser = await User.findById(socket.userId).lean();
    if (!dbUser) return;

    let room = [...rooms.values()].find(r =>
      r &&
      r.type === "public" &&
      r.status === "lobby" &&
      r.mode === "Quick" &&
      r.gameplay === "Timer" &&
      r.players.length < r.maxPlayers
    );

    if (!room) {
      const code = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      room = {
        code,
        type: "public",
        mode: "Quick",
        gameplay: "Timer",

        // 🎨 RANDOM THEME (FIXED)
        theme: getRandomTheme(),

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
        correctGuessers: new Set(),
        revealedLetters: [],
        turnEnded: false,
        hasDrawn: false,
        revealsDone: 0,
        phase: "draw",

        __rooms: rooms,
      };

      rooms.set(code, room);
      console.log(`🌍 PUBLIC ROOM CREATED → ${code}`);
    }

    let player = room.players.find(
      p => String(p.id) === String(socket.userId)
    );

    if (!player) {
      player = {
        id: socket.userId,
        username: dbUser.username,
        socketId: socket.id,
        connected: true,
        score: 0,
      };
      room.players.push(player);
    } else {
      player.connected = true;
      player.socketId = socket.id;
    }

    socket.join(room.code);
    socket.emit("MATCH_FOUND", { code: room.code });

    emitGameState(io, room);
  });

  socket.on("disconnect", () => {
    rooms.forEach(room => {
      if (!room) return;

      const player = room.players.find(
        p => p.socketId === socket.id
      );
      if (!player) return;

      player.connected = false;
      emitGameState(io, room);

      if (
        room.type === "private" &&
        room.players.every(p => !p.connected)
      ) {
        scheduleRoomCleanup(room.code, rooms);
      }
    });
  });
};
