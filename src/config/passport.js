const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const createToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:5090/auth/google/callback",
      passReqToCallback: true,
    },
    async (req, _, __, profile, done) => {
      const email = profile.emails[0].value;
      const guestId = req.query.state || null;

      let user = await User.findOne({ email });

      if (!user && guestId) {
        const guest = await User.findById(guestId);
        if (guest && guest.isGuest) {
          guest.email = email;
          guest.username = profile.displayName;
          guest.isGuest = false;
          await guest.save();
          user = guest;
        }
      }

      if (!user) {
        user = await User.create({
          email,
          username: profile.displayName,
          isGuest: false,
          coins: 300,
          gems: 100,
        });
      }

      const token = createToken(user);
      done(null, { token });
    }
  )
);


module.exports = passport;
