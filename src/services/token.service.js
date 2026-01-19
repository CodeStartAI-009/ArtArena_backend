const jwt = require("jsonwebtoken");

exports.generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      isGuest: user.isGuest,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
