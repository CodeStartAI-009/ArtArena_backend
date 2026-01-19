const bcrypt = require("bcrypt");
const User = require("../models/User");
const { generateGuestName } = require("./username.service");

exports.createGuest = async () => {
  const user = await User.create({
    provider: "guest",
    username: generateGuestName()
  });
  return user;
};

exports.createEmailUser = async (email, password) => {
  const hash = await bcrypt.hash(password, 10);
  return User.create({
    provider: "email",
    email,
    password: hash
  });
};
