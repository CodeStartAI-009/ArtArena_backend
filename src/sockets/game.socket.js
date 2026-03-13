
const gameEngine = require("../engine/gameEngine");
const roundEngine = require("../engine/roundEngine");
const scoringEngine = require("../engine/scoringEngine");
const emitGameState = require("../utils/emitGameState");
const { applyRewards } = require("../engine/rewardEngine");
const scheduleRoomCleanup = require("../utils/scheduleRoomCleanup");
const User = require("../models/User");
const generateGuestName = require("../services/username.service");

const GUESS_REWARD = { xp: 10, coins: 10 };

const AUTO_START_PLAYERS = 4;
const MAX_PLAYERS = 12;
const MIN_PLAYERS_WITH_BOTS = 4;

/* WAIT TIMES */
const SINGLE_PLAYER_WAIT = 30 * 1000;
const BOT_FILL_WAIT = 10 * 1000;

const THEMES = [
  "classic",
  "forest",
  "desert",
  "space",
  "ice",
  "candy",
  "volcano",
];

const getRandomTheme = () =>
  THEMES[Math.floor(Math.random() * THEMES.length)];

/* =========================
   BOT HELPER
========================= */

function addBots(room) {

  const needed = MIN_PLAYERS_WITH_BOTS - room.players.length;
  if (needed <= 0) return;

  for (let i = 0; i < needed; i++) {

    let username;

    /* ensure unique username */

    do {
      username = generateGuestName();
    } while (room.players.some(p => p.username === username));

    room.players.push({
      id: `bot_${Math.random().toString(36).slice(2,8)}`,
      username,
      socketId: null,
      connected: true,
      isBot: true,
      score: 0,
      guessedCorrectly: false
    });

  }

}

/* =========================
   START PUBLIC GAME
========================= */

function startPublicGame(io, room) {

  if (!room || room.status !== "lobby") return;

  if (room.players.length < MIN_PLAYERS_WITH_BOTS) {
    addBots(room);
  }

  room.status = "starting";

  if (room.manualStartTimer) {
    clearTimeout(room.manualStartTimer);
    room.manualStartTimer = null;
  }

  io.to(room.code).emit("GAME_STARTING");

  setTimeout(() => {

    if (room.status !== "starting") return;

    gameEngine.startGame(io, room);

    io.to(room.code).emit("GAME_STARTED", {
      code: room.code
    });

  }, 2000);

}

/* =========================
   PUBLIC START CONTROL
========================= */

function tryPublicStart(io, room) {

  if (!room || room.type !== "public") return;
  if (room.status !== "lobby") return;

  if (room.players.length >= AUTO_START_PLAYERS) {
    startPublicGame(io, room);
    return;
  }

  if (room.players.length === 1 && !room.manualStartTimer) {

    room.manualStartTimer = setTimeout(() => {

      if (room.status !== "lobby") return;

      addBots(room);
      emitGameState(io, room);

      setTimeout(() => startPublicGame(io, room), BOT_FILL_WAIT);

    }, SINGLE_PLAYER_WAIT);

    return;
  }

  if (
    room.players.length >= 2 &&
    room.players.length < AUTO_START_PLAYERS &&
    !room.manualStartTimer
  ) {

    room.manualStartTimer = setTimeout(() => {

      if (room.status !== "lobby") return;

      addBots(room);
      emitGameState(io, room);

      setTimeout(() => startPublicGame(io, room), BOT_FILL_WAIT);

    }, 10000);

  }

}

/* =========================
   SHARED GUESS LOGIC
========================= */

async function processGuess(io, room, playerId, guess) {

  if (!room || room.turnEnded) return;
  if (!room.guessingAllowed || !room.currentWord) return;

  if (String(room.drawerId) === String(playerId)) return;

  const player = room.players.find(
    p => String(p.id) === String(playerId)
  );

  if (!player || player.guessedCorrectly) return;

  const normalized = guess?.trim().toLowerCase();
  if (!normalized) return;

  /* WRONG GUESS */

  if (normalized !== room.currentWord.toLowerCase()) {

    io.to(room.code).emit("WRONG_GUESS", {
      userId: playerId,
      guess: normalized
    });

    return;
  }

  /* CORRECT GUESS */

  if (!room.correctGuessers)
    room.correctGuessers = new Set();

  const points = scoringEngine.awardScore(room, playerId);

  player.guessedCorrectly = true;
  room.correctGuessers.add(playerId);

  io.to(room.code).emit("CORRECT_GUESS", {
    userId: playerId,
    username: player.username,
    points
  });

  console.log(`${player.username} +${points}`);

  /* rewards only for humans */

  if (!player.isBot) {

    try {

      const result =
        await applyRewards(playerId, GUESS_REWARD);

      if (result?.user) {

        io.to(room.code).emit("USER_UPDATED", {
          users: [{
            id: playerId,
            xp: result.user.xp,
            level: result.user.level,
            coins: result.user.coins,
            gems: result.user.gems ?? 0
          }]
        });

      }

    } catch (err) {
      console.error("Reward error:", err);
    }

  }

  roundEngine.onAnyGuess(io, room, playerId, true);

  emitGameState(io, room);

}

/* =========================
   SOCKET HANDLERS
========================= */

module.exports = (io, socket, rooms) => {

/* PRIVATE START */

socket.on("START_GAME", ({ code }) => {

  const room = rooms.get(code);

  if (!room || room.type !== "private") return;
  if (room.status !== "lobby") return;
  if (room.players.length < 2) return;

  room.status = "starting";

  io.to(code).emit("GAME_STARTING");

  setTimeout(() => {

    if (room.status !== "starting") return;

    gameEngine.startGame(io, room);

    io.to(code).emit("GAME_STARTED", { code });

  }, 3000);

});

/* GAME JOIN */

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

});

/* WORD SELECT */

socket.on("SELECT_WORD", ({ code, word }) => {

  const room = rooms.get(code);
  if (!room || room.turnEnded) return;

  if (String(room.drawerId) !== String(socket.userId)) return;
  if (!room.wordChoices?.includes(word)) return;

  io.to(code).emit("WORD_SELECTED", {
    wordLength: word.length
  });

  roundEngine.onWordSelected(io, room, socket.userId, word);

});

/* HUMAN GUESS */

socket.on("GUESS", async ({ code, guess }) => {

  const room = rooms.get(code);
  if (!room) return;

  await processGuess(io, room, socket.userId, guess);

});

/* PUBLIC MATCHMAKING */

socket.on("PLAY_PUBLIC", async () => {

  if (!socket.userId) return;

  const dbUser =
    await User.findById(socket.userId).lean();

  if (!dbUser) return;

  let room = [...rooms.values()].find(
    r =>
      r?.type === "public" &&
      r.status === "lobby" &&
      r.players.length < MAX_PLAYERS
  );

  if (!room) {

    const code =
      Math.random().toString(36)
      .substring(2,8)
      .toUpperCase();

    room = {
      code,
      type:"public",
      mode:"Quick",
      gameplay:"Timer",
      theme:getRandomTheme(),
      maxPlayers:MAX_PLAYERS,
      totalRounds:5,
      timer:30,
      status:"lobby",
      players:[],
      round:1,   // FIXED (was 0)
      drawerIndex:0,
      manualStartTimer:null,
      __rooms:rooms
    };

    rooms.set(code, room);

    console.log(`🌍 PUBLIC ROOM CREATED → ${code}`);
  }

  let player = room.players.find(
    p => String(p.id) === String(socket.userId)
  );

  if (!player){

    player = {
      id: socket.userId,
      username: dbUser.username,
      socketId: socket.id,
      connected: true,
      score: 0
    };

    room.players.push(player);

  } else {

    player.connected = true;
    player.socketId = socket.id;

  }

  socket.join(room.code);

  socket.emit("MATCH_FOUND",{ code: room.code });

  emitGameState(io, room);

  tryPublicStart(io, room);

});

/* DISCONNECT */

socket.on("disconnect", () => {

  rooms.forEach(room => {

    const player = room.players.find(
      p => p.socketId === socket.id
    );

    if (!player) return;

    player.connected = false;

    emitGameState(io, room);

    if (
      room.type === "private" &&
      room.players.every(p => !p.connected)
    ){
      scheduleRoomCleanup(room.code, rooms);
    }

  });

});

};
