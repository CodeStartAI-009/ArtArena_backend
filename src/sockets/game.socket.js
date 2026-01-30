 // backend/src/sockets/game.socket.js

const gameEngine = require("../engine/gameEngine");
const roundEngine = require("../engine/roundEngine");
const scoringEngine = require("../engine/scoringEngine");
const emitGameState = require("../utils/emitGameState");
const { applyRewards } = require("../engine/rewardEngine");
const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");
const User = require("../models/User");

const GUESS_REWARD = { xp: 10, coins: 10 };

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

    const player = room.players.find(p => String(p.id) === String(userId));
    if (player) {
      player.connected = true;
      player.socketId = socket.id;
    }

    emitGameState(io, room);

    if (room.wordChoices && room.drawerId === userId) {
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

    /* 🚫 Drawer cannot guess */
    if (String(room.drawerId) === String(playerId)) return;

    const player = room.players.find(p => String(p.id) === String(playerId));
    if (!player || player.guessedCorrectly) return;

    const normalized = guess?.trim().toLowerCase();
    if (!normalized) return;

    const correct =
      normalized === room.currentWord.toLowerCase();

    /* 🔑 CRITICAL FIX */
    if (correct) {
      player.guessedCorrectly = true;   // ✅ FIX
    }

    roundEngine.onAnyGuess(io, room, playerId, correct);

    if (!correct) {
      io.to(code).emit("WRONG_GUESS", {
        userId: playerId,
        guess: normalized,
      });
      return;
    }

    /* ---------- SCORE ---------- */
    const scored = scoringEngine.awardScore(room, playerId);
    if (!scored) return;

    /* ---------- REWARDS ---------- */
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

    emitGameState(io, room); // ✅ force sync immediately
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

    if (
      room.type === "private" &&
      room.players.every(p => !p.connected)
    ) {
      scheduleRoomCleanup(room.code, rooms);
    }
  });

  socket.on("disconnect", () => {
    rooms.forEach(room => {
      if (!room) return;

      const player = room.players.find(p => p.socketId === socket.id);
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
