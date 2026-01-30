 // backend/src/engine/roundEngine.js

const { pickRandomWords } = require("./wordEngine");
const emitGameState = require("../utils/emitGameState");
const gameEngine = require("./gameEngine");

/* =========================
   START ROUND
========================= */
function startRound(io, room) {
  if (!room || room.status !== "playing") return;

  /* ---------- HARD RESET ---------- */
  room.guessingAllowed = false;
  room.currentWord = null;
  room.revealedLetters = [];
  room.correctGuessers = new Set();
  room.totalGuesses = 0;
  room.drawStartedAt = null;
  room.turnEnded = false;

  room.drawing = [];
  room.undoStack = [];

  room.players.forEach(p => (p.guessedCorrectly = false));

  clearAllRoundTimers(room);

  /* ---------- CLEAR CANVAS ---------- */
  io.to(room.code).emit("CLEAR_CANVAS");

  /* ---------- DRAWER ---------- */
  room.drawerId = room.players[room.drawerIndex].id;
  console.log(`🌀 Round ${room.round}, Drawer: ${room.drawerId}`);

  /* ---------- WORD CHOICES ---------- */
  room.wordChoices = pickRandomWords(room.mode, 3);

  /* ---------- WORD NOT SELECTED (10s) ---------- */
  room.wordSelectTimer = setTimeout(() => {
    if (!room.currentWord && !room.turnEnded) {
      console.log("⏱️ No word selected in 10s → ending turn");
      endTurn(io, room);
    }
  }, 10_000);

  io.to(room.code).emit("ROUND_START", {
    round: room.round,
    drawerId: room.drawerId,
    wordLength: 0,
  });

  /* ---------- SEND WORD TO DRAWER ---------- */
  for (const socket of io.sockets.sockets.values()) {
    if (socket.userId === room.drawerId) {
      socket.emit("WORD_CHOICES", room.wordChoices);
      break;
    }
  }

  emitGameState(io, room);
}

/* =========================
   WORD SELECTED
========================= */
function onWordSelected(io, room) {
  if (room.turnEnded) return;

  clearTimeout(room.wordSelectTimer);

  /* ---------- NO DRAW FOR 15s ---------- */
  room.noDrawTimer = setTimeout(() => {
    if (!room.drawStartedAt && !room.turnEnded) {
      console.log("⏱️ No drawing for 15s → ending turn");
      endTurn(io, room);
    }
  }, 15_000);

  setupRevealAndEndTimers(io, room);
}

/* =========================
   DRAW TRACKING
========================= */
function onDrawerDraw(io, room) {
  if (!room || room.status !== "playing" || room.turnEnded) return;

  const now = Date.now();
  room.drawStartedAt ??= now;

  /* ---------- DRAWER IDLE (5s) ---------- */
  clearTimeout(room.drawIdleTimer);
  room.drawIdleTimer = setTimeout(() => {
    if (!room.guessingAllowed && !room.turnEnded) {
      console.log("✏️ Drawer idle 5s → allow guessing");
      allowGuessing(io, room);
    }
  }, 5_000);
}

/* =========================
   ALLOW GUESSING
========================= */
function allowGuessing(io, room) {
  if (room.guessingAllowed || room.turnEnded) return;

  room.guessingAllowed = true;
  io.to(room.code).emit("GUESSING_STARTED");
  emitGameState(io, room);
}

/* =========================
   GUESS HANDLING
========================= */
function onAnyGuess(io, room, userId, correct) {
  if (!room.guessingAllowed || room.turnEnded) return;

  if (correct) {
    room.correctGuessers.add(userId);

    const needed = room.players.length - 1; // exclude drawer
    if (room.correctGuessers.size >= needed) {
      console.log("🎯 All players guessed correctly → ending turn");
      endTurn(io, room);
      return;
    }
  }

  emitGameState(io, room);
}

/* =========================
   TURN END
========================= */
function endTurn(io, room) {
  if (!room || room.turnEnded) return;

  room.turnEnded = true;
  clearAllRoundTimers(room);

  room.drawing = [];
  room.undoStack = [];

  io.to(room.code).emit("CLEAR_CANVAS");

  io.to(room.code).emit("TURN_END", {
    word: room.currentWord,
  });

  /* ---------- END GAME ---------- */
  if (gameEngine.shouldEndGame(room)) {
    gameEngine.endGame(io, room, "rule_reached");
    return;
  }

  /* ---------- NEXT ROUND ---------- */
  rotateDrawer(room);
  if (room.drawerIndex === 0) room.round += 1;

  startRound(io, room);
}

/* =========================
   REVEAL + END TIMERS
========================= */
function setupRevealAndEndTimers(io, room) {
  const total =
    room.gameplay === "Timer"
      ? room.timer * 1000
      : 30_000;

  const step = total / 3;

  room.revealTimer1 = setTimeout(() => {
    if (!room.turnEnded) revealHint(io, room);
  }, step);

  room.revealTimer2 = setTimeout(() => {
    if (!room.turnEnded) revealHint(io, room);
  }, step * 2);

  /* ---------- ONLY THIS ENDS TURN BY TIME ---------- */
  room.endTimer = setTimeout(() => {
    if (!room.turnEnded) {
      console.log("⏱️ Selected time ended → ending turn");
      endTurn(io, room);
    }
  }, total);
}

/* =========================
   HINT SYSTEM
========================= */
function revealHint(io, room) {
  if (!room.currentWord) return;

  const hidden = [];
  for (let i = 0; i < room.currentWord.length; i++) {
    if (!room.revealedLetters.includes(i)) hidden.push(i);
  }

  if (!hidden.length) return;

  const index = hidden[Math.floor(Math.random() * hidden.length)];
  room.revealedLetters.push(index);

  io.to(room.code).emit("HINT_REVEALED", {
    index,
    letter: room.currentWord[index],
  });

  emitGameState(io, room);
}

/* =========================
   HELPERS
========================= */
function rotateDrawer(room) {
  room.drawerIndex =
    (room.drawerIndex + 1) % room.players.length;
}

function clearAllRoundTimers(room) {
  [
    "wordSelectTimer",
    "noDrawTimer",
    "drawIdleTimer",
    "revealTimer1",
    "revealTimer2",
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
