 // backend/src/controllers/room.controller.js

const Room = require("../models/Room");
const User = require("../models/User");

const THEMES = [
  "classic",
  "forest",
  "desert",
  "space",
  "ice",
  "candy",
  "volcano",
];

const ROOM_CREATE_COST = 10;
const ROOM_JOIN_COST = 5;

const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

const getRandomTheme = () =>
  THEMES[Math.floor(Math.random() * THEMES.length)];

/* =========================
   CREATE ROOM  (-50 COINS)
========================= */
const createRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      theme,
      isPrivate,
      score,
      timer,
      mode,
      gameplay,
      totalRounds,
      maxPlayers,
    } = req.body;

    /* ---------- DEDUCT COINS ---------- */
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: ROOM_CREATE_COST } },
      { $inc: { coins: -ROOM_CREATE_COST } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        message: "Not enough coins to create a room",
      });
    }

    /* ---------- TIMER NORMALIZATION ---------- */
    const resolvedTimer =
      gameplay === "Timer" && Number.isFinite(timer)
        ? timer
        : null;

    let code;
    while (true) {
      code = generateCode();
      if (!(await Room.exists({ code }))) break;
    }

    const resolvedTheme =
      theme === "random" || !THEMES.includes(theme)
        ? getRandomTheme()
        : theme;

    const room = await Room.create({
      code,
      theme: resolvedTheme,
      type: isPrivate ? "private" : "public",
      mode,
      gameplay,
      timer: resolvedTimer,
      maxScore: score ?? null,
      totalRounds: totalRounds ?? null,
      maxPlayers,
      status: "lobby",
      createdBy: userId,
    });

    console.log("🏗️ ROOM CREATED (-50 coins)", {
      code: room.code,
      createdBy: user.username,
      coinsLeft: user.coins,
    });

    res.status(201).json({
      room,
      coins: user.coins,
    });
  } catch (err) {
    console.error("❌ CREATE ROOM ERROR", err);
    res.status(500).json({ message: "Failed to create room" });
  }
};

/* =========================
   GET ROOM
========================= */
const getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code }).lean();
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json({ room });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch room" });
  }
};

/* =========================
   JOIN ROOM (-25 COINS)
========================= */
const joinRoom = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const userId = req.user._id;

    const room = await Room.findOne({ code });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.type !== "private") {
      return res.status(400).json({
        message: "Public rooms must be joined via matchmaking",
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({
        message: "Game already started",
      });
    }

    /* ---------- DEDUCT JOIN COINS ---------- */
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: ROOM_JOIN_COST } },
      { $inc: { coins: -ROOM_JOIN_COST } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        message: "Not enough coins to join the room",
      });
    }

    console.log("🚪 ROOM JOINED (-25 coins)", {
      roomCode: code,
      username: user.username,
      coinsLeft: user.coins,
    });

    res.json({
      room,
      coins: user.coins,
    });
  } catch (err) {
    console.error("❌ JOIN ROOM ERROR", err);
    res.status(500).json({ message: "Failed to join room" });
  }
};

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
};
