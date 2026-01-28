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

exports.createRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const { theme, isPrivate, score, ...rest } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: userId, coins: { $gte: ROOM_COST } },
      { $inc: { coins: -ROOM_COST } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ message: "Not enough coins" });
    }

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
      maxScore: score ?? null,
      ...rest,
      status: "lobby",
    });

    console.log(`🏗️ ROOM CREATED → ${room.code} (${room.type})`);

    res.status(201).json({ room });
  } catch (err) {
    console.error("❌ CREATE ROOM ERROR:", err);
    res.status(500).json({ message: "Failed to create room" });
  }
};


/* ================= GET ROOM ================= */
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code }).lean();

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json({ room });
  } catch (err) {
    console.error("❌ GET ROOM ERROR:", err);
    res.status(500).json({ message: "Failed to fetch room" });
  }
};

/* ================= JOIN ROOM (PRIVATE ONLY) ================= */
exports.joinRoom = async (req, res) => {
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

    if (room.maxPlayers && room.maxPlayers <= 0) {
      return res.status(400).json({ message: "Room is full" });
    }

    // 🔥 Do NOT add players here — socket handles it
    res.json({ room });
  } catch (err) {
    console.error("❌ JOIN ROOM ERROR:", err);
    res.status(500).json({ message: "Failed to join room" });
  }
};
