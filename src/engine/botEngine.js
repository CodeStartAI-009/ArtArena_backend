const loadQuickDraw = require("./quickDrawLoader");
const convertQuickDraw = require("./convertQuickDraw");

/* =========================
   BOT DRAWING
========================= */

function startBotDrawing(io, room) {

  if (!room || !room.currentWord) return;

  console.log("🤖 BOT START DRAWING:", room.currentWord);

  /* clear previous bot drawing */
  if (room.botDrawInterval) {
    clearInterval(room.botDrawInterval);
    room.botDrawInterval = null;
  }

  const drawingData = loadQuickDraw(room.currentWord);

  if (!drawingData) {
    console.warn("No QuickDraw data for:", room.currentWord);
    return;
  }

  const strokes = convertQuickDraw(drawingData);

  if (!Array.isArray(strokes) || strokes.length === 0) {
    console.warn("Invalid strokes for:", room.currentWord);
    return;
  }

  const TOTAL_TIME = 12000;

  const intervalTime = Math.max(
    35,
    Math.floor(TOTAL_TIME / strokes.length)
  );

  let index = 0;

  room.botDrawInterval = setInterval(() => {

    /* stop drawing if game ended */
    if (!room || room.turnEnded || room.status !== "playing") {
      clearInterval(room.botDrawInterval);
      room.botDrawInterval = null;
      return;
    }

    if (index >= strokes.length) {
      clearInterval(room.botDrawInterval);
      room.botDrawInterval = null;
      return;
    }

    const stroke = strokes[index];

    if (!stroke) {
      index++;
      return;
    }

    room.drawing.push(stroke);

    io.to(room.code).emit("DRAW", stroke);

    index++;

  }, intervalTime);
}

/* =========================
   BOT GUESSING
========================= */

function startBotGuessing(io, room) {

  if (!room || !room.currentWord) return;

  const bots = room.players.filter(
    p => p.isBot && p.id !== room.drawerId
  );

  if (!bots.length) return;

  bots.forEach(bot => {

    const delay = 5000 + Math.random() * 6000;

    setTimeout(() => {

      if (!room || room.turnEnded) return;
      if (!room.guessingAllowed) return;

      const player = room.players.find(p => p.id === bot.id);

      if (!player || player.guessedCorrectly) return;

      const correctChance = Math.random();

      /* WRONG GUESS */

      if (correctChance > 0.35) {

        const fakeWords = [
          "tree","dog","house","car","sun","boat","apple"
        ];

        const fake =
          fakeWords[Math.floor(Math.random()*fakeWords.length)];

        io.to(room.code).emit("WRONG_GUESS",{
          userId: bot.id,
          guess: fake
        });

        return;
      }

      /* CORRECT GUESS */

      if (!room.correctGuessers)
        room.correctGuessers = new Set();

      room.correctGuessers.add(bot.id);

      player.guessedCorrectly = true;

      player.score += 15;

      console.log("🤖 BOT GUESSED:", bot.username);

      io.to(room.code).emit("CORRECT_GUESS",{
        userId: bot.id,
        username: bot.username,
        points: 15
      });

    }, delay);

  });

}

module.exports = {
  startBotDrawing,
  startBotGuessing
};