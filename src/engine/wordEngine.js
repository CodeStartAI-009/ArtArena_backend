// backend/src/engine/wordEngine.js

const WORDS = {
  Classic: {
    Part1: ["cat", "dog", "house", "car", "ball"],
    Part2: ["robot", "camera", "shark", "rainbow"],
    Part3: ["kangaroo", "volcano", "dinosaur", "helicopter"]
  },

  Quick: {
    Part1: ["cat", "sun", "hat", "cup"],
    Part2: ["apple", "banana", "pizza"],
    Part3: ["running", "jumping", "swimming"]
  },

  Kids: {
    Part1: ["teddy", "panda", "kitten"],
    Part2: ["ice cream", "cupcake", "balloon"],
    Part3: ["superhero", "princess", "spaceship"]
  },

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
    return null;
  }

  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================
   PREVENT REPEAT
========================= */
function getNonRepeatingWord(pool, room) {
  if (!room.usedWords) {
    room.usedWords = new Set();
  }

  const available = pool.filter(
    word => !room.usedWords.has(word)
  );

  // 🔥 If all words used → reset
  if (available.length === 0) {
    room.usedWords.clear();
    return getRandomFromArray(pool);
  }

  const selected = getRandomFromArray(available);

  if (selected) {
    room.usedWords.add(selected);
  }

  return selected;
}

/* =========================
   PICK WORDS
========================= */
function pickRandomWords(mode, gameplay = null, room = null) {
  /* ===== TOGETHER MODE ===== */
  if (mode === "Together") {
    const pool = WORDS.Together?.Drawing || [];
    return room
      ? getNonRepeatingWord(pool, room)
      : getRandomFromArray(pool);
  }

  /* ===== NORMAL MODES ===== */
  const selectedMode = WORDS[mode] || WORDS.Classic;

  if (!room) {
    return [
      getRandomFromArray(selectedMode.Part1),
      getRandomFromArray(selectedMode.Part2),
      getRandomFromArray(selectedMode.Part3)
    ];
  }

  return [
    getNonRepeatingWord(selectedMode.Part1, room),
    getNonRepeatingWord(selectedMode.Part2, room),
    getNonRepeatingWord(selectedMode.Part3, room)
  ];
}

module.exports = {
  pickRandomWords
};