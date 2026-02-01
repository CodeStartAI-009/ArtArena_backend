// backend/src/engine/roundEngine.js

const { pickRandomWords } = require("./wordEngine");
const emitGameState = require("../utils/emitGameState");
const gameEngine = require("./gameEngine");

/* =========================
   SAFE TIMER
========================= */
function getSafeDuration(room, fallback = 30_000) {
  const t = Number(room.timer);
  return Number.isFinite(t) && t > 0 ? t * 1000 : fallback;
}

/* =========================
   START ROUND
========================= */
function startRound(io, room) {
  if (!room || room.status !== "playing") return;

  console.log("🟢 START ROUND", {
    room: room.code,
    round: room.round,
    mode: room.mode,
  });

  room.phase = room.mode === "Quick" ? "draw" : "live";
  room.guessingAllowed = false;
  room.currentWord = null;
  room.wordSelected = false;
  room.revealedLetters = [];
  room.correctGuessers = new Set();
  room.turnEnded = false;
  room.revealsDone = 0;
  room.hasDrawn = false;

  room.drawing = [];
  room.undoStack = [];
  room.players.forEach(p => (p.guessedCorrectly = false));

  clearAllRoundTimers(room);
  io.to(room.code).emit("CLEAR_CANVAS");

  room.drawerId = room.players[room.drawerIndex]?.id;
  room.wordChoices = pickRandomWords(room.mode, 3);

  room.wordSelectTimer = setTimeout(() => {
    if (room.turnEnded || room.wordSelected) return;
    console.log("⏱️ WORD NOT SELECTED → END TURN");
    endTurn(io, room);
  }, 10_000);

  io.to(room.code).emit("ROUND_START", {
    round: room.round,
    drawerId: room.drawerId,
    wordLength: 0,
  });

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
function onWordSelected(io, room, userId, word) {
  if (!room || room.turnEnded) return;
  if (room.wordSelected) return;
  if (userId !== room.drawerId) return;

  room.wordSelected = true;
  room.currentWord = word;
  clearTimeout(room.wordSelectTimer);

  console.log("✅ WORD SELECTED", word);

  room.mode === "Quick"
    ? startQuickDrawPhase(io, room)
    : startClassicPhase(io, room);

  emitGameState(io, room);
}

/* =========================
   CLASSIC MODE
========================= */
function startClassicPhase(io, room) {
  room.noDrawTimer = setTimeout(() => {
    if (!room.hasDrawn && !room.turnEnded) endTurn(io, room);
  }, 15_000);

  room.drawIdleTimer = setTimeout(() => {
    if (!room.turnEnded) allowGuessing(io, room);
  }, 5_000);

  startRevealAndEndTimers(io, room, getSafeDuration(room));
}

/* =========================
   QUICK MODE – DRAW
========================= */
function startQuickDrawPhase(io, room) {
  clearAllRoundTimers(room);

  const duration = getSafeDuration(room);
  room.phase = "draw";
  room.guessingAllowed = false;
  room.hasDrawn = false;

  room.drawPhaseTimer = setTimeout(() => {
    if (room.turnEnded) return;
    if (!room.hasDrawn) return endTurn(io, room);
    startQuickGuessPhase(io, room);
  }, duration);
}

/* =========================
   QUICK MODE – GUESS
========================= */
function startQuickGuessPhase(io, room) {
  clearAllRoundTimers(room);
  if (room.turnEnded) return;

  room.phase = "guess";
  room.guessingAllowed = true;

  io.to(room.code).emit("GUESSING_STARTED");
  emitGameState(io, room);

  startRevealAndEndTimers(io, room, getSafeDuration(room));
}

/* =========================
   DRAW TRACKING
========================= */
function onDrawerDraw(io, room) {
  if (room.turnEnded) return;
  room.hasDrawn = true;
}

/* =========================
   ALLOW GUESSING
========================= */
function allowGuessing(io, room) {
  if (!room || room.turnEnded || room.guessingAllowed) return;

  if (room.mode === "Quick") {
    if (room.phase === "draw" && !room.hasDrawn) return endTurn(io, room);
    if (room.phase === "draw") startQuickGuessPhase(io, room);
    return;
  }

  clearTimeout(room.drawIdleTimer);
  clearTimeout(room.noDrawTimer);

  room.guessingAllowed = true;
  io.to(room.code).emit("GUESSING_STARTED");
  emitGameState(io, room);
}

/* =========================
   ✅ CORRECT GUESS HANDLING (FIXED)
========================= */
function onAnyGuess(io, room, userId, correct) {
  if (!room.guessingAllowed || room.turnEnded || !correct) return;

  const player = room.players.find(p => p.id === userId);
  if (!player || player.guessedCorrectly) return;

  // ✅ LOCK PLAYER
  player.guessedCorrectly = true;
  room.correctGuessers.add(userId);

  // ✅ AWARD SCORE IMMEDIATELY
  gameEngine.applyScore(io, room, userId);

  // ✅ ALL GUESSERS DONE → END TURN
  const totalGuessers = room.players.length - 1;
  if (room.correctGuessers.size >= totalGuessers) {
    endTurn(io, room);
  }
}

/* =========================
   REVEALS + END
========================= */
function startRevealAndEndTimers(io, room, duration) {
  const step = duration / 3;
  room.revealTimer1 = setTimeout(() => revealHint(io, room), step);
  room.revealTimer2 = setTimeout(() => revealHint(io, room), step * 2);
  room.endTimer = setTimeout(() => endTurn(io, room), duration);
}

/* =========================
   HINT SYSTEM
========================= */
function revealHint(io, room) {
  if (!room.currentWord || room.turnEnded || room.revealsDone >= 2) return;

  const hidden = [];
  for (let i = 0; i < room.currentWord.length; i++) {
    if (!room.revealedLetters.some(r => r.index === i)) hidden.push(i);
  }

  if (!hidden.length) return;

  const index = hidden[Math.floor(Math.random() * hidden.length)];
  const letter = room.currentWord[index];

  room.revealedLetters.push({ index, letter });
  room.revealsDone++;

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

  io.to(room.code).emit("CLEAR_CANVAS");
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
   CLEANUP
========================= */
function clearAllRoundTimers(room) {
  [
    "wordSelectTimer",
    "noDrawTimer",
    "drawIdleTimer",
    "drawPhaseTimer",
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
