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

/* ================= HELPERS ================= */
const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

const getRandomTheme = () =>
  THEMES[Math.floor(Math.random() * THEMES.length)];

/* ================= CREATE ROOM ================= */
exports.createRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const { theme, isPrivate, score, ...rest } = req.body;

    // 1️⃣ Validate user + deduct coins atomically
    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: ROOM_COST } },
      { $inc: { coins: -ROOM_COST } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        message: "Not enough coins to create a room",
        required: ROOM_COST,
      });
    }

    // 2️⃣ Generate unique room code
    let code;
    let exists = true;

    while (exists) {
      code = generateCode();
      exists = await Room.exists({ code });
    }

    // 3️⃣ Resolve theme
    const resolvedTheme =
      theme === "random" || !THEMES.includes(theme)
        ? getRandomTheme()
        : theme;

    // 4️⃣ Create room
    const room = await Room.create({
      code,
      theme: resolvedTheme,
      type: isPrivate ? "private" : "public",
      maxScore: score ?? null,
      ...rest,
      players: [
        {
          id: user._id,
          username: user.username,
        },
      ],
    });

    console.log(`🏗️ ROOM CREATED → ${room.code}`);

    // 5️⃣ Respond
    res.status(201).json({
      room,
      coinsLeft: user.coins,
    });
  } catch (err) {
    console.error("❌ CREATE ROOM ERROR:", err);
    res.status(500).json({ message: "Failed to create room" });
  }
};

/* ================= GET ROOM ================= */
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json({ room });
  } catch (err) {
    console.error("❌ GET ROOM ERROR:", err);
    res.status(500).json({ message: "Failed to fetch room" });
  }
};

/* ================= JOIN ROOM ================= */
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ message: "Room is full" });
    }

    if (room.started) {
      return res.status(400).json({ message: "Game already started" });
    }

    const alreadyJoined = room.players.some(
      p => String(p.id) === String(req.user._id)
    );

    if (!alreadyJoined) {
      room.players.push({
        id: req.user._id,
        username: req.user.username,
      });
      await room.save();
    }

    res.json({ room });
  } catch (err) {
    console.error("❌ JOIN ROOM ERROR:", err);
    res.status(500).json({ message: "Failed to join room" });
  }
};
