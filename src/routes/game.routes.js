const router = require("express").Router();
const game = require("../controllers/game.controller");

router.get("/ping", game.ping);

module.exports = router;
