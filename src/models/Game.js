// backend/models/Game.js
const mongoose = require("mongoose");

/* ===============================
   PLAYER STATE (PER GAME)
================================ */
const playerStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  username: {
    type: String,
    required: true,
  },

  score: {
    type: Number,
    default: 0,
  },

  coinsEarned: {
    type: Number,
    default: 0,
  },

  guessedCorrectly: {
    type: Boolean,
    default: false,
  },
});

/* ===============================
   ROUND STATE
================================ */
const roundSchema = new mongoose.Schema({
  roundNumber: Number,

  drawerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  word: {
    type: String, // hidden from guessers
    required: true,
  },

  revealedLetters: [
    {
      index: Number,
      letter: String,
    },
  ],

  startTime: Date,
  endTime: Date,

  isCompleted: {
    type: Boolean,
    default: false,
  },
});

/* ===============================
   GAME SCHEMA
================================ */
const gameSchema = new mongoose.Schema(
  {
    /* LINK TO ROOM */
    roomCode: {
      type: String,
      required: true,
      index: true,
    },

    /* MODE CONFIG */
    mode: {
      type: String,
      enum: ["Classic", "Quick", "Kids"],
      required: true,
    },

    gameplay: {
      type: String,
      enum: ["Timer", "Score"],
      required: true,
    },

    maxScore: Number, // only for score mode
    roundTimer: Number, // seconds (only timer mode)

    /* ECONOMY */
    entryFee: {
      type: Number,
      default: 10, // coins taken at game start
    },

    prizePool: {
      type: Number,
      default: 0,
    },

    /* PLAYERS */
    players: [playerStateSchema],

    /* ROUNDS */
    rounds: [roundSchema],

    currentRoundIndex: {
      type: Number,
      default: 0,
    },

    /* GAME STATUS */
    status: {
      type: String,
      enum: ["waiting", "running", "ended"],
      default: "waiting",
    },

    winner: {
      userId: mongoose.Schema.Types.ObjectId,
      username: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Game", gameSchema);
