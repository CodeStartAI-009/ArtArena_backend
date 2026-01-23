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
    },
    async (_, __, ___, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            email,
            username: profile.displayName,
            isGuest: false,
            coins: 200,
            level: 1,
            xp: 0,
            gems: 0,
          });
        }

        done(null, { token: createToken(user) });
      } catch (err) {
        done(err);
      }
    }
  )
);


module.exports = passport;
