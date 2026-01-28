 // models/Room.js
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  code: { type: String, unique: true },

  type: { type: String, enum: ["private", "public"], required: true },

  mode: String,
  gameplay: String,
  timer: String,
  maxScore: Number,
  totalRounds: Number,
  maxPlayers: Number,
  theme: String,

  status: {
    type: String,
    enum: ["lobby", "playing", "ended"],
    default: "lobby",
  },

  players: {
    type: [
      {
        id: mongoose.Schema.Types.ObjectId,
        username: String,
      },
    ],
    default: [],
  },
});

module.exports = mongoose.model("Room", roomSchema);
