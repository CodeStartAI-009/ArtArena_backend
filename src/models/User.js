const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    /* =========================
       AUTH TYPE
    ========================= */
    isGuest: {
      type: Boolean,
      default: true,
    },

    googleId: {
      type: String,
      sparse: true,
    },

    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    /* =========================
       PROFILE
    ========================= */
    username: {
      type: String,
      required: true,
      trim: true,
    },

    /* =========================
       GAME STATS
    ========================= */
    xp: {
      type: Number,
      default: 0,
    },

    level: {
      type: Number,
      default: 1,
    },

    coins: {
      type: Number,
      default: 0,
    },

    gems: {
      type: Number,
      default: 0,
    },

    /* =========================
       REFERRAL SYSTEM
    ========================= */

    // Code this user shares (only real users need this)
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Referral code used when this user joined
    referredBy: {
      type: String,
      index: true,
    },

    // Prevents duplicate coin rewards
    referralRewarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
