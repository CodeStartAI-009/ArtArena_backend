const WORDS = {
  // ⭐ Classic = Medium difficulty (normal words)
  Classic: {
    Part1: [
      "cat", "dog", "house", "car", "ball", "tree", "sun", "apple",
      "book", "fish", "hat", "cup", "star", "shoe", "chair", "bed",
      "cake", "door", "key", "clock"
    ],

    Part2: [
      "pencil", "robot", "camera", "shark", "rainbow",
      "rocket", "candy", "banana", "chef", "crown", "pizza",
      "soccer", "island", "notebook", "phone", "calendar", "keychain"
    ],

    Part3: [
      "kangaroo", "microscope", "zebra", "volcano",
      "jellyfish", "dragonfly", "dinosaur", "telescope",
      "helicopter", "submarine", "pyramid", "lighthouse",
      "hedgehog", "chameleon", "nightmare"
    ]
  },

  // ⚡ Quick = EASY words (very simple)
  Quick: {
    Part1: [
      "cat", "dog", "sun", "hat", "ball", "pen", "cup", "fish", "tree", "car"
    ],

    Part2: [
      "apple", "banana", "pizza", "burger", "school", "chair", "clock", "phone"
    ],

    Part3: [
      "running", "jumping", "swimming", "dancing", "singing", "drawing", "reading"
    ]
  },

  // 🧒 Kids = Kids friendly (fun + simple + safe)
  Kids: {
    Part1: [
      "teddy", "panda", "kitten", "puppy", "bunny", "duck", "monkey", "lion"
    ],

    Part2: [
      "ice cream", "cupcake", "lollipop", "toy car", "balloon",
      "storybook", "playground", "rainbow"
    ],

    Part3: [
      "superhero", "princess", "magic wand", "toy robot",
      "monster truck", "firetruck", "racecar", "spaceship"
    ]
  }
};

function getRandomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomWords(mode) {
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
