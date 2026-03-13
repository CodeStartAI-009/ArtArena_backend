const { pickRandomWords } = require("./wordEngine");
const emitGameState = require("../utils/emitGameState");
const { startBotDrawing } = require("./botEngine");
const scoringEngine = require("./scoringEngine");

/* =========================
   CONSTANTS
========================= */

const WORD_SELECT_TIME = 10000;
const NO_DRAW_TIMEOUT = 15000;
const CLASSIC_GUESS_TIME = 30000;
const DRAW_IDLE_TO_GUESS = 10000;
const HINT_WINDOW = 10000;
const QUICK_TURN_TIME = 30000; // 30 seconds
/* =========================
   START ROUND
========================= */

function startRound(io, room) {

  if (!room || room.status !== "playing") return;
  if (room.mode === "Together") return;

  console.log("🟢 START ROUND", room.code, room.round, room.mode);

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

  const drawer = room.players[room.drawerIndex];
  if (!drawer) return;

  room.drawerId = drawer.id;

  room.wordChoices = pickRandomWords(room.mode, 3);

  io.to(room.code).emit("ROUND_START", {
    round: room.round,
    drawerId: room.drawerId,
    wordLength: 0,
  });

  /* send state first */
  emitGameState(io, room);

  /* then send choices (prevents first round bug) */
  setTimeout(() => {
    sendWordChoices(io, room);
  }, 30);

  /* =========================
     BOT DRAWER
  ========================= */

  if (drawer.isBot) {

    const quickPart1 = [
      "cat","sun","hat","cup",
      "leaf","star","sock","key","fish",
      "apple","banana","pizza",
      "camera","flower","guitar",
      "helmet","train","truck"
    ];

    const botWord =
      quickPart1[Math.floor(Math.random() * quickPart1.length)];

    setTimeout(() => {

      if (room.turnEnded) return;

      room.wordSelected = true;
      room.currentWord = botWord;

      console.log("🤖 BOT WORD:", botWord);

      io.to(room.code).emit("WORD_SELECTED", {
        wordLength: botWord.length
      });

      clearTimeout(room.wordSelectTimer);

      startNoDrawTimer(io, room);

      room.guessingAllowed = true;

      startBotDrawing(io, room);
      startBotGuessing(io, room);

      emitGameState(io, room);

    }, 1200);
  }

  room.wordSelectTimer = setTimeout(() => {

    if (!room.wordSelected && !room.turnEnded) {
      endTurn(io, room);
    }

  }, WORD_SELECT_TIME);

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

  /* start anti idle timer */
  startNoDrawTimer(io, room);

  /* allow guessing */
  room.guessingAllowed = true;

  /* bots can guess */
  startBotGuessing(io, room);

  /* =========================
     QUICK MODE TIMER (30s)
  ========================= */

  if (room.mode === "Quick") {

    room.turnTimer = setTimeout(() => {

      if (!room.turnEnded) {
        endTurn(io, room);
      }

    }, 30000);

  }

  /* =========================
     CLASSIC MODE
  ========================= */

  if (room.mode === "Classic") {

    startHintSystem(io, room, CLASSIC_GUESS_TIME);

  }

  emitGameState(io, room);
}
/* =========================
   ALLOW GUESSING
========================= */

function allowGuessing(io, room) {

  if (!room || room.turnEnded) return;

  if (room.guessingAllowed) return;

  room.guessingAllowed = true;

  room.lastGuessAt = Date.now();

  io.to(room.code).emit("GUESSING_STARTED");

  /* bots can start guessing */
  startBotGuessing(io, room);

  emitGameState(io, room);

  if (room.mode === "Classic") {
    startHintSystem(io, room, CLASSIC_GUESS_TIME);
  }

}
/* =========================
   NO DRAW TIMER
========================= */

function startNoDrawTimer(io, room) {

  if (!room) return;

  room.noDrawTimer = setTimeout(() => {

    if (!room.hasDrawn && !room.turnEnded) {

      console.log("⚠️ Drawer did not draw");

      endTurn(io, room);

    }

  }, 15000); // 15 seconds

}
/* =========================
   HUMAN GUESS HANDLER
========================= */
function onAnyGuess(io, room, userId, correct) {

  if (!room || room.turnEnded) return;
  if (!room.guessingAllowed) return;
  if (!correct) return;

  const player = room.players.find(
    p => String(p.id) === String(userId)
  );

  if (!player || player.guessedCorrectly) return;

  player.guessedCorrectly = true;

  if (!room.correctGuessers)
    room.correctGuessers = new Set();

  room.correctGuessers.add(userId);

  room.lastGuessAt = Date.now();

  checkTurnEnd(io, room);

}
/* =========================
   BOT GUESSING
========================= */
function startBotGuessing(io, room) {

  if (!room || !room.currentWord) return;

  if (!room.correctGuessers)
    room.correctGuessers = new Set();

  const bots = room.players.filter(
    p => p.isBot && p.id !== room.drawerId
  );

  bots.forEach(bot => {

    const delay = 4000 + Math.random() * 6000;

    setTimeout(() => {

      if (!room || room.turnEnded) return;
      if (!room.guessingAllowed) return;

      const player = room.players.find(p => p.id === bot.id);
      if (!player || player.guessedCorrectly) return;

      /* 65% chance wrong guess */
      if (Math.random() > 0.35) {

        const fakeWords = ["tree","dog","car","sun","boat"];

        const fake =
          fakeWords[Math.floor(Math.random()*fakeWords.length)];

        io.to(room.code).emit("WRONG_GUESS",{
          userId: bot.id,
          guess: fake
        });

        return;
      }

      /* correct guess */

      const points = scoringEngine.awardScore(room, bot.id);

      player.guessedCorrectly = true;

      room.correctGuessers.add(bot.id);

      io.to(room.code).emit("CORRECT_GUESS", {
        userId: bot.id,
        username: bot.username,
        points
      });
      console.log("🤖 Bots guessing:", bots.map(b => b.username));
      emitGameState(io, room);

      checkTurnEnd(io, room);

    }, delay);

  });

}

/* =========================
   DRAW TRACKING
========================= */

function onDrawerDraw(io, room) {

  if (!room) return;
  if (room.turnEnded) return;

  /* already handled */
  if (room.hasDrawn) return;

  /* mark drawing started */
  room.hasDrawn = true;

  console.log("✏️ Drawer started drawing:", room.drawerId);

  /* =========================
     QUICK / KIDS MODE
     Guess immediately
  ========================= */

  if (room.mode === "Quick" || room.mode === "Kids") {

    allowGuessing(io, room);
    return;

  }

  /* =========================
     CLASSIC MODE
     Delay guessing slightly
  ========================= */

  if (room.mode === "Classic") {

    if (room.drawIdleTimer) return;

    room.drawIdleTimer = setTimeout(() => {

      if (!room.turnEnded) {
        allowGuessing(io, room);
      }

    }, DRAW_IDLE_TO_GUESS);

  }

}
 
/* =========================
   HINT SYSTEM
========================= */

function startHintSystem(io, room, totalDuration) {

  room.hintsGiven = 0;
  room.lastGuessAt = Date.now();

  if (room.hintWindowTimer)
    clearTimeout(room.hintWindowTimer);

  scheduleHintWindow(io, room);

  room.endTimer = setTimeout(() => {

    if (!room.turnEnded)
      endTurn(io, room);

  }, totalDuration);

}

function scheduleHintWindow(io, room) {

  if (!room || room.turnEnded) return;
  if (room.hintsGiven >= 2) return;

  room.hintWindowTimer = setTimeout(() => {

    if (!room || room.turnEnded) return;

    const now = Date.now();

    if (!room.lastGuessAt ||
        now - room.lastGuessAt >= HINT_WINDOW) {

      revealHint(io, room);
      room.hintsGiven++;

    }

    scheduleHintWindow(io, room);

  }, HINT_WINDOW);

}

function revealHint(io, room) {

  if (!room.currentWord) return;
  if (room.revealedLetters.length >= 2) return;

  const hidden = [];

  for (let i = 0; i < room.currentWord.length; i++) {

    const already =
      room.revealedLetters.some(r => r.index === i);

    if (!already) hidden.push(i);

  }

  if (!hidden.length) return;

  const index =
    hidden[Math.floor(Math.random() * hidden.length)];

  const letter = room.currentWord[index];

  room.revealedLetters.push({ index, letter });

  io.to(room.code).emit("HINT_REVEALED", {
    index,
    letter
  });

  emitGameState(io, room);
}

/* =========================
   TURN END
========================= */

function checkTurnEnd(io, room) {

  if (!room || room.turnEnded) return;

  const totalGuessers = room.players.length - 1;

  const needed = Math.ceil(totalGuessers * 0.8);

  if (room.correctGuessers.size >= needed) {

    console.log(
      "🟢 Ending turn:",
      room.correctGuessers.size,
      "/",
      totalGuessers
    );

    endTurn(io, room);
  }

}
function endTurn(io, room) {

  if (!room || room.turnEnded) return;

  room.turnEnded = true;
  if (room.botDrawInterval) {
    clearInterval(room.botDrawInterval);
    room.botDrawInterval = null;
  }
  clearAllRoundTimers(room);

  io.to(room.code).emit("TURN_END", {
    word: room.currentWord
  });

  room.drawerIndex =
    (room.drawerIndex + 1) % room.players.length;

  const gameEngine = require("./gameEngine");

  if (room.drawerIndex === 0) {

    if (
      typeof room.totalRounds === "number" &&
      room.round >= room.totalRounds
    ) {
      gameEngine.endGame(io, room, "rule_reached");
      return;
    }

    room.round++;
  }

  startRound(io, room);
}

/* =========================
   HELPERS
========================= */

function sendWordChoices(io, room) {

  const drawer = room.players.find(
    p => String(p.id) === String(room.drawerId)
  );

  if (!drawer || !drawer.socketId) return;

  io.to(drawer.socketId).emit(
    "WORD_CHOICES",
    room.wordChoices
  );
}

function clearAllRoundTimers(room) {

  [
    "wordSelectTimer",
    "noDrawTimer",
    "drawIdleTimer",
    "hintWindowTimer",
    "endTimer",
    "turnTimer"
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
  endTurn
};