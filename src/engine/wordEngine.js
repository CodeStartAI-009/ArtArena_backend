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

  // 🔥 Together Mode Word Pool
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

function getRandomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomWords(mode, gameplay) {
  // 🔥 Together Mode → return single word
  if (mode === "Together" && gameplay === "Drawing") {
    return getRandomFromArray(WORDS.Together.Drawing);
  }

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
