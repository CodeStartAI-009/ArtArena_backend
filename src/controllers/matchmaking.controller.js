const Room = require("../models/Room");

exports.findPublicRoom = async (req, res) => {
  const room = await Room.findOne({
    type: "public",
    status: "playing",
  });

  res.json({ room });
};
