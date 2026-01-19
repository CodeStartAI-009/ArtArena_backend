const router = require("express").Router();
const controller = require("../controllers/matchmaking.controller");

router.get("/find", controller.findPublicRoom);

module.exports = router;
