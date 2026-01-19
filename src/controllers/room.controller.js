// backend/src/controllers/room.controller.js
const Room = require("../models/Room");

const THEMES = ["classic","forest","desert","space","ice","candy","volcano"];

const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

exports.createRoom = async (req, res) => {
  const { theme, isPrivate, score, ...rest } = req.body;

  const room = await Room.create({
    code: generateCode(),
    theme: theme === "random"
      ? THEMES[Math.floor(Math.random() * THEMES.length)]
      : theme,

    type: isPrivate ? "private" : "public",

    maxScore: score,
    ...rest,

    players: [{
      id: req.user._id,
      username: req.user.username,
    }],
  });

  console.log(
    `🏗️ ROOM CREATED → ${room.code}
     ▸ Type: ${room.type}
     ▸ Mode: ${room.mode}
     ▸ Gameplay: ${room.gameplay}
     ▸ Max Players: ${room.maxPlayers}
     ▸ Total Rounds: ${room.totalRounds ?? "∞"}
     ▸ Max Score: ${room.maxScore ?? "N/A"}
     ▸ Timer: ${room.timer ?? "N/A"}
     ▸ Theme: ${room.theme}`
  );

  res.status(201).json({ room });
};

exports.getRoom = async (req, res) => {
  const room = await Room.findOne({ code: req.params.code }).lean();
  if (!room) return res.status(404).json({ message: "Room not found" });

  res.json({ room });
};

exports.joinRoom = async (req, res) => {
  const room = await Room.findOne({ code: req.params.code });
  if (!room) return res.status(404).json({ message: "Room not found" });

  const exists = room.players.some(
    p => String(p.id) === String(req.user._id)
  );

  if (!exists) {
    room.players.push({
      id: req.user._id,
      username: req.user.username,
    });
    await room.save();
  }

  res.json({ room });
};
