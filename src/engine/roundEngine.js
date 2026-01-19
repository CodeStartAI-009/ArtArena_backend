 // backend/src/engine/roundEngine.js

const { pickRandomWords } = require("./wordEngine");
const emitGameState = require("../utils/emitGameState");
const gameEngine = require("./gameEngine");

/* =========================
   ROUND START
========================= */
function startRound(io, room) {
  if (!room || room.status !== "playing") return;

  /* ---------- RESET ROUND STATE ---------- */
  room.guessingAllowed = false;
  room.remainingTime = null;

  room.firstGuessAt = null;
  room.correctGuessers = new Set();
  room.totalGuesses = 0;

  room.drawing = [];
  room.undoStack = [];
  room.revealedLetters = [];

  room.players.forEach(p => {
    p.guessedCorrectly = false;
  });

  /* ---------- DRAWER ---------- */
  room.drawerId = room.players[room.drawerIndex].id;
  console.log(`🌀 Round ${room.round}, Drawer: ${room.drawerId}`);

  /* ---------- WORD ---------- */
  room.wordChoices = pickRandomWords(room.mode, 3);
  room.currentWord = null;

  /* ---------- CLEAR TIMERS ---------- */
  clearAllRoundTimers(room);

  /* ---------- DRAWER INACTIVITY ---------- */
  room.noDrawTimer = setTimeout(() => {
    if (room.drawStartedAt===null && room.status === "playing") {
      console.log("⏱️ No drawing for 10s → ending turn");
      endTurn(io, room);
    }
  }, 10_000);

  /* ---------- EMIT ---------- */
  io.to(room.code).emit("ROUND_START", {
    round: room.round,
    drawerId: room.drawerId,
    wordLength: 0,
  });

  /* ---------- SEND WORD CHOICES (DRAWER ONLY) ---------- */
  for (const socket of io.sockets.sockets.values()) {
    if (socket.userId === room.drawerId) {
      socket.emit("WORD_CHOICES", room.wordChoices);
      break;
    }
  }

  emitGameState(io, room);
}

/* =========================
   DRAW TRACKING
========================= */
function onDrawerDraw(io, room) {
  if (!room || room.status !== "playing") return;

  const now = Date.now();
  room.drawStartedAt ??= now;
  room.lastDrawAt = now;

  if (!room.guessingAllowed) {
    clearTimeout(room.drawIdleTimer);
    room.drawIdleTimer = setTimeout(() => {
      console.log("✏️ Drawer idle 5s → auto allow guessing");
      allowGuessing(io, room);
    }, 5_000);
  }
}

/* =========================
   GUESSING START
========================= */
function allowGuessing(io, room) {
  if (!room || room.status !== "playing") return;
  if (room.guessingAllowed) return;

  room.guessingAllowed = true;
  io.to(room.code).emit("GUESSING_STARTED");

  clearAllRoundTimers(room);

  /* =========================
     TIMER GAMEPLAY
  ========================== */
  if (room.gameplay === "Timer") {
    const duration =
      Number.isFinite(room.timer) && room.timer > 0
        ? room.timer
        : 30;

    room.mainTimer = setTimeout(() => {
      console.log("⏱️ Timer expired → ending turn");
      endTurn(io, room);
    }, duration * 1000);

    emitGameState(io, room);
    return;
  }

  /* =========================
     NON-TIMER GAMEPLAY
  ========================== */

  room.noGuessTimer = setTimeout(() => {
    if (room.totalGuesses === 0 && room.status === "playing") {
      console.log("⏱️ No guesses for 15s → ending turn");
      endTurn(io, room);
    }
  }, 15_000);

  emitGameState(io, room);
}
function onAnyGuess(io, room, userId, isCorrect) {
  if (!room || room.status !== "playing") return;
  if (!room.guessingAllowed) return;

  /* =========================
     TIMER GAMEPLAY
     (NO GUESS LIMITS)
  ========================== */
  if (room.gameplay === "Timer") {
    if (!isCorrect) return;
    if (room.correctGuessers.has(userId)) return;

    room.correctGuessers.add(userId);
    emitGameState(io, room);
    return;
  }

  /* =========================
     NON-TIMER GAMEPLAY
  ========================== */

  room.totalGuesses += 1;

  const maxGuesses = room.players.length * 3;
  if (room.totalGuesses >= maxGuesses) {
    console.log("❌ Guess limit reached → ending turn");
    endTurn(io, room);
    return;
  }

  if (!isCorrect) return;
  if (room.correctGuessers.has(userId)) return;

  room.correctGuessers.add(userId);

  if (!room.firstGuessAt) {
    room.firstGuessAt = Date.now();

    io.to(room.code).emit("LAST_CHANCE_STARTED", { seconds: 20 });

    room.lastChanceTimer = setTimeout(() => {
      console.log("⏱️ Last chance over → ending turn");
      endTurn(io, room);
    }, 20_000);
  }

  emitGameState(io, room);
}


/* =========================
   TURN END
========================= */
function endTurn(io, room) {
  if (!room || room.status !== "playing") return;

  clearAllRoundTimers(room);

  io.to(room.code).emit("TURN_END", {
    word: room.currentWord,
    players: room.players,
  });

  room.drawing = [];
  room.undoStack = [];
  io.to(room.code).emit("CLEAR_CANVAS");

  rotateDrawer(room);

  if (room.drawerIndex === 0) {
    room.round += 1;
  }

  if (gameEngine.shouldEndGame(room)) {
    gameEngine.endGame(io, room, "rule_reached");
    return;
  }

  startRound(io, room);
}

/* =========================
   HINT SYSTEM
========================= */
function revealHint(io, room) {
  if (!room.currentWord) return null;

  const hidden = [];
  for (let i = 0; i < room.currentWord.length; i++) {
    if (!room.revealedLetters.includes(i)) hidden.push(i);
  }

  if (!hidden.length) return null;

  const index = hidden[Math.floor(Math.random() * hidden.length)];
  room.revealedLetters.push(index);

  return {
    index,
    letter: room.currentWord[index],
  };
}

/* =========================
   HELPERS
========================= */
function rotateDrawer(room) {
  room.drawerIndex =
    (room.drawerIndex + 1) % room.players.length;
}

function clearAllRoundTimers(room) {
  clearTimeout(room.noDrawTimer);
  clearTimeout(room.drawIdleTimer);
  clearTimeout(room.noGuessTimer);
  clearTimeout(room.lastChanceTimer);
  clearInterval(room.mainTimer);

  room.noDrawTimer = null;
  room.drawIdleTimer = null;
  room.noGuessTimer = null;
  room.lastChanceTimer = null;
  room.mainTimer = null;
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  startRound,
  allowGuessing,
  onDrawerDraw,
  onAnyGuess,
  endTurn,
  revealHint,
};
