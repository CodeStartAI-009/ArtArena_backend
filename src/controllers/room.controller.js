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

const ROOM_COST = 50;

const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

const getRandomTheme = () =>
  THEMES[Math.floor(Math.random() * THEMES.length)];

/* =========================
   CREATE ROOM
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

    /* ---------- ENSURE TIMER IS NUMBER ---------- */
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
      timer: resolvedTimer, // ✅ NUMBER STORED
      maxScore: score ?? null,
      totalRounds: totalRounds ?? null,
      maxPlayers,
      status: "lobby",
    });

    console.log("🏗️ ROOM CREATED", {
      code: room.code,
      type: room.type,
      mode: room.mode,
      gameplay: room.gameplay,
      timer: room.timer, // ✅ number
      maxScore: room.maxScore,
      totalRounds: room.totalRounds,
      maxPlayers: room.maxPlayers,
    });

    res.status(201).json({ room });
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
   JOIN ROOM
========================= */
const joinRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.type !== "private") {
      return res.status(400).json({
        message: "Public rooms must be joined via matchmaking",
      });
    }

    if (room.status !== "lobby") {
      return res.status(400).json({ message: "Game already started" });
    }

    res.json({ room });
  } catch (err) {
    res.status(500).json({ message: "Failed to join room" });
  }
};

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
};
