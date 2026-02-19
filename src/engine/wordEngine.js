// backend/src/engine/wordEngine.js

const WORDS = {
  /* =========================
     CLASSIC MODE
  ========================== */
  Classic: {
    Part1: ["cat", "dog", "house", "car", "ball"],
    Part2: ["robot", "camera", "shark", "rainbow"],
    Part3: ["kangaroo", "volcano", "dinosaur", "helicopter"]
  },

  /* =========================
     QUICK MODE
  ========================== */
  Quick: {
    Part1: ["cat", "sun", "hat", "cup"],
    Part2: ["apple", "banana", "pizza"],
    Part3: ["running", "jumping", "swimming"]
  },

  /* =========================
     KIDS MODE
  ========================== */
  Kids: {
    Part1: ["teddy", "panda", "kitten"],
    Part2: ["ice cream", "cupcake", "balloon"],
    Part3: ["superhero", "princess", "spaceship"]
  },

  /* =========================
     TOGETHER MODE
  ========================== */
  Together: {
    Drawing: [
      "giant dragon",
      "underwater city",
      "haunted castle",
      "space battle",
      "magic forest",
      "flying car",
      "robot invasion",
      "treasure island",
      "time machine",
      "superhero team"
    ]
  }
};

/* =========================
   SAFE RANDOM PICK
========================= */
function getRandomFromArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return null; // 🔥 prevents crash
  }

  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================
   PICK WORDS
========================= */
function pickRandomWords(mode, gameplay = null) {
  /* ===== TOGETHER MODE ===== */
  if (mode === "Together") {
    const drawingPool = WORDS.Together?.Drawing || [];
    return getRandomFromArray(drawingPool);
  }

  /* ===== NORMAL MODES ===== */
  const selectedMode = WORDS[mode] || WORDS.Classic;

  return [
    getRandomFromArray(selectedMode.Part1),
    getRandomFromArray(selectedMode.Part2),
    getRandomFromArray(selectedMode.Part3)
  ];
}

module.exports = {
  pickRandomWords
};
