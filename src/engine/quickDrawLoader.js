 
const fs = require("fs");
const path = require("path");

const cache = {};

function loadQuickDraw(word) {

  if (!word) return null;

  const normalized = word.toLowerCase().trim();

  if (cache[normalized]) {
    const drawings = cache[normalized];
    return drawings[Math.floor(Math.random() * drawings.length)];
  }

  try {

    const filePath = path.join(
      __dirname,
      "../data/quickdraw",
      `${normalized}.json`
    );

    if (!fs.existsSync(filePath)) {
      console.warn("QuickDraw file missing:", filePath);
      return null;
    }

    const drawings = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );

    if (!Array.isArray(drawings)) {
      console.warn("QuickDraw invalid format:", normalized);
      return null;
    }

    cache[normalized] = drawings;

    return drawings[Math.floor(Math.random() * drawings.length)];

  } catch (err) {

    console.error("QuickDraw load error:", err);
    return null;

  }
}

module.exports = loadQuickDraw;
