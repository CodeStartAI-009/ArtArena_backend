exports.getMe = async (req, res) => {
    try {
      res.json({ user: req.user });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  };
  