// backend/src/engine/roundEngine.js

const { pickRandomWords } = require("./wordEngine");
const emitGameState = require("../utils/emitGameState");
const gameEngine = require("./gameEngine");

/* =========================
   CONSTANTS
========================= */
const WORD_SELECT_TIME = 10_000;
const NO_DRAW_TIMEOUT = 15_000;
const CLASSIC_GUESS_TIME = 30_000;
const DRAW_IDLE_TO_GUESS = 5_000;
const HINT_WINDOW = 10_000; // 10s rolling window

/* =========================
   START ROUND
========================= */
function startRound(io, room) {
  if (!room || room.status !== "playing") return;

  console.log("🟢 START ROUND", room.code, room.round, room.mode);

  /* ---------- Reset round state ---------- */
  room.phase = "draw";
  room.guessingAllowed = false;
  room.currentWord = null;
  room.wordSelected = false;
  room.revealedLetters = [];
  room.correctGuessers = new Set();
  room.turnEnded = false;
  room.hasDrawn = false;

  room.lastGuessAt = null;
  room.hintsGiven = 0;

  room.drawing = [];
  room.undoStack = [];
  room.players.forEach(p => (p.guessedCorrectly = false));

  clearAllRoundTimers(room);
  io.to(room.code).emit("CLEAR_CANVAS");

  /* ---------- Drawer ---------- */
  room.drawerId = room.players[room.drawerIndex]?.id;
  room.wordChoices = pickRandomWords(room.mode, 3);

  /* ---------- Word select timer ---------- */
  room.wordSelectTimer = setTimeout(() => {
    if (!room.wordSelected && !room.turnEnded) endTurn(io, room);
  }, WORD_SELECT_TIME);

  /* ---------- Notify ---------- */
  io.to(room.code).emit("ROUND_START", {
    round: room.round,
    drawerId: room.drawerId,
    wordLength: 0,
  });

  sendWordChoices(io, room);
  emitGameState(io, room);
}

/* =========================
   WORD SELECTED
========================= */
function onWordSelected(io, room, userId, word) {
  if (!room || room.turnEnded) return;
  if (room.wordSelected || userId !== room.drawerId) return;

  room.wordSelected = true;
  room.currentWord = word;
  clearTimeout(room.wordSelectTimer);

  console.log("✅ WORD SELECTED:", word);

  if (room.mode === "Kids") {
    room.guessingAllowed = true;
    emitGameState(io, room);
    return;
  }

  startNoDrawTimer(io, room);

  if (room.mode === "Quick") {
    room.guessingAllowed = true;
    startHintSystem(io, room, getSafeDuration(room));
  }
}

/* =========================
   DRAW TRACKING
========================= */
function onDrawerDraw(io, room) {
  if (room.turnEnded) return;

  if (!room.hasDrawn) {
    room.hasDrawn = true;

    if (room.mode === "Classic") {
      room.drawIdleTimer = setTimeout(() => {
        allowGuessing(io, room);
      }, DRAW_IDLE_TO_GUESS);
    }
  }
}

/* =========================
   GUESSING
========================= */
function allowGuessing(io, room) {
  if (room.turnEnded || room.guessingAllowed) return;

  room.guessingAllowed = true;
  room.lastGuessAt = Date.now();

  io.to(room.code).emit("GUESSING_STARTED");
  emitGameState(io, room);

  if (room.mode === "Classic") {
    startHintSystem(io, room, CLASSIC_GUESS_TIME);
  }
}

/* =========================
   CORRECT GUESS
========================= */
function onAnyGuess(io, room, userId, correct) {
  if (!correct || !room || room.turnEnded || !room.guessingAllowed) return;

  const player = room.players.find(p => String(p.id) === String(userId));
  if (!player || player.guessedCorrectly) return;

  player.guessedCorrectly = true;
  room.correctGuessers.add(userId);

  // 🔁 reset rolling hint window
  room.lastGuessAt = Date.now();

  gameEngine.applyScore(io, room, userId);

  const totalGuessers = room.players.length - 1;
  if (room.correctGuessers.size >= totalGuessers) {
    endTurn(io, room);
  }
}

/* =========================
   TIMERS
========================= */
function startNoDrawTimer(io, room) {
  room.noDrawTimer = setTimeout(() => {
    if (!room.hasDrawn && !room.turnEnded) endTurn(io, room);
  }, NO_DRAW_TIMEOUT);
}

/* =========================
   ROLLING HINT SYSTEM
========================= */
function startHintSystem(io, room, totalDuration) {
  room.hintsGiven = 0;
  room.lastGuessAt = Date.now();

  scheduleHintWindow(io, room);
  room.endTimer = setTimeout(() => endTurn(io, room), totalDuration);
}

function scheduleHintWindow(io, room) {
  if (room.turnEnded || room.hintsGiven >= 2) return;

  room.hintWindowTimer = setTimeout(() => {
    if (room.turnEnded) return;

    const now = Date.now();
    const guessedRecently =
      room.lastGuessAt && now - room.lastGuessAt < HINT_WINDOW;

    if (!guessedRecently) {
      revealHint(io, room);
      room.hintsGiven++;
    }

    scheduleHintWindow(io, room);
  }, HINT_WINDOW);
}

/* =========================
   HINT SYSTEM
========================= */
function revealHint(io, room) {
  if (
    !room.currentWord ||
    room.turnEnded ||
    room.revealedLetters.length >= 2
  ) return;

  const hidden = [];
  for (let i = 0; i < room.currentWord.length; i++) {
    if (!room.revealedLetters.some(r => r.index === i)) {
      hidden.push(i);
    }
  }

  if (!hidden.length) return;

  const index = hidden[Math.floor(Math.random() * hidden.length)];
  const letter = room.currentWord[index];

  room.revealedLetters.push({ index, letter });

  io.to(room.code).emit("HINT_REVEALED", { index, letter });
  emitGameState(io, room);
}

/* =========================
   TURN END
========================= */
function endTurn(io, room) {
  if (room.turnEnded) return;

  room.turnEnded = true;
  clearAllRoundTimers(room);

  io.to(room.code).emit("TURN_END", { word: room.currentWord });

  if (gameEngine.shouldEndGame(room)) {
    gameEngine.endGame(io, room, "rule_reached");
    return;
  }

  room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
  if (room.drawerIndex === 0) room.round++;

  startRound(io, room);
}

/* =========================
   HELPERS
========================= */
function sendWordChoices(io, room) {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.userId === room.drawerId) {
      socket.emit("WORD_CHOICES", room.wordChoices);
      break;
    }
  }
}

function getSafeDuration(room, fallback = 30_000) {
  const t = Number(room.timer);
  return Number.isFinite(t) && t > 0 ? t * 1000 : fallback;
}

function clearAllRoundTimers(room) {
  [
    "wordSelectTimer",
    "noDrawTimer",
    "drawIdleTimer",
    "hintWindowTimer",
    "endTimer",
  ].forEach(t => {
    if (room[t]) clearTimeout(room[t]);
    room[t] = null;
  });
}

module.exports = {
  startRound,
  onWordSelected,
  onDrawerDraw,
  allowGuessing,
  onAnyGuess,
  endTurn,
};
