const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  code: { type: String, unique: true },

  type: {
    type: String,
    enum: ["private", "public"],
    default: "private",
  },

  mode: String,
  gameplay: String,

  timer: String,        // "20 sec", "30 sec"
  maxScore: Number,     // for Score mode
  totalRounds: Number,  // for Classic / Quick / Kids

  maxPlayers: Number,
  theme: String,

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
