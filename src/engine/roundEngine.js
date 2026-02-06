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
const HINT_WINDOW = 10_000; // rolling window

/* =========================
   START ROUND
========================= */
function startRound(io, room) {
  if (!room || room.status !== "playing") return;

  // ❌ Never run rounds in Together mode
  if (room.mode === "Together") return;

  console.log("🟢 START ROUND", {
    room: room.code,
    round: room.round,
    mode: room.mode,
  });

  /* ---------- Reset round state ---------- */
  room.phase = "draw";
  room.guessingAllowed = false;
  room.wordSelected = false;
  room.currentWord = null;

  room.revealedLetters = [];
  room.correctGuessers = new Set();
  room.turnEnded = false;
  room.hasDrawn = false;

  room.lastGuessAt = null;
  room.hintsGiven = 0;

  room.drawing = [];
  room.undoStack = [];

  room.players.forEach(p => {
    p.guessedCorrectly = false;
  });

  clearAllRoundTimers(room);
  io.to(room.code).emit("CLEAR_CANVAS");

  /* ---------- Drawer ---------- */
  const drawer = room.players[room.drawerIndex];
  if (!drawer) return;

  room.drawerId = drawer.id;
  room.wordChoices = pickRandomWords(room.mode, 3);

  /* ---------- Word select timeout ---------- */
  room.wordSelectTimer = setTimeout(() => {
    if (!room.wordSelected && !room.turnEnded) {
      console.log("⏱️ No word selected → end turn");
      endTurn(io, room);
    }
  }, WORD_SELECT_TIME);

  /* ---------- Notify clients ---------- */
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
  if (room.wordSelected) return;
  if (String(userId) !== String(room.drawerId)) return;

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
    emitGameState(io, room);
  }
}

/* =========================
   DRAW TRACKING
========================= */
function onDrawerDraw(io, room) {
  if (!room || room.turnEnded) return;

  if (!room.hasDrawn) {
    room.hasDrawn = true;

    if (room.mode === "Classic") {
      clearTimeout(room.drawIdleTimer);

      room.drawIdleTimer = setTimeout(() => {
        allowGuessing(io, room);
      }, DRAW_IDLE_TO_GUESS);
    }
  }
}

/* =========================
   ALLOW GUESSING
========================= */
function allowGuessing(io, room) {
  if (!room || room.turnEnded || room.guessingAllowed) return;

  room.guessingAllowed = true;
  room.lastGuessAt = Date.now();

  io.to(room.code).emit("GUESSING_STARTED");
  emitGameState(io, room);

  if (room.mode === "Classic") {
    startHintSystem(io, room, CLASSIC_GUESS_TIME);
  }
}

/* =========================
   GUESS HANDLING
========================= */
function onAnyGuess(io, room, userId, correct) {
  if (!room || room.turnEnded || !room.guessingAllowed) return;
  if (!correct) return;

  const player = room.players.find(
    p => String(p.id) === String(userId)
  );

  if (!player || player.guessedCorrectly) return;

  player.guessedCorrectly = true;
  room.correctGuessers.add(userId);

  room.lastGuessAt = Date.now();

  // ✅ APPLY SCORE HERE (THIS WAS CRITICAL)
  gameEngine.applyScore(io, room, userId);

  const totalGuessers = room.players.length - 1;

  if (room.correctGuessers.size >= totalGuessers) {
    console.log("🏁 All players guessed → end turn");
    endTurn(io, room);
  }
}

/* =========================
   TIMERS
========================= */
function startNoDrawTimer(io, room) {
  room.noDrawTimer = setTimeout(() => {
    if (!room.hasDrawn && !room.turnEnded) {
      console.log("❌ No drawing → end turn");
      endTurn(io, room);
    }
  }, NO_DRAW_TIMEOUT);
}

/* =========================
   HINT SYSTEM
========================= */
function startHintSystem(io, room, totalDuration) {
  room.hintsGiven = 0;
  room.lastGuessAt = Date.now();

  scheduleHintWindow(io, room);

  room.endTimer = setTimeout(() => {
    console.log("⏱️ Guess time over → end turn");
    endTurn(io, room);
  }, totalDuration);
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
  if (!room || room.turnEnded) return;

  room.turnEnded = true;
  clearAllRoundTimers(room);

  io.to(room.code).emit("TURN_END", {
    word: room.currentWord,
  });

  const isLastDrawerOfRound =
    room.drawerIndex === room.players.length - 1;

  if (isLastDrawerOfRound && gameEngine.shouldEndGame(room)) {
    gameEngine.endGame(io, room, "rule_reached");
    return;
  }

  room.drawerIndex =
    (room.drawerIndex + 1) % room.players.length;

  if (room.drawerIndex === 0) {
    room.round += 1;
  }

  startRound(io, room);
}

/* =========================
   HELPERS
========================= */
function sendWordChoices(io, room) {
  for (const socket of io.sockets.sockets.values()) {
    if (String(socket.userId) === String(room.drawerId)) {
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

/* =========================
   EXPORTS
========================= */
module.exports = {
  startRound,
  onWordSelected,
  onDrawerDraw,
  allowGuessing,
  onAnyGuess,
  endTurn,
};
