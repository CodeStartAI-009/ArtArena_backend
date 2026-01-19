const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    isGuest: { type: Boolean, default: true },

    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },

    username: { type: String, required: true },

    avatar: { type: String },

    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },

    coins: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
