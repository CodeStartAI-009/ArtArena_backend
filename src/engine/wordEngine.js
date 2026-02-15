const WORDS = {
  Classic: {
    Part1: [
      "cat", "dog", "house", "car", "ball", "tree", "sun", "apple",
      "book", "fish", "hat", "cup", "star", "shoe", "chair", "bed",
      "cake", "door", "bee", "key", "bridge", "clock", "train"
    ],

    Part2: [
      "guitar", "pencil", "robot", "camera", "shark", "rainbow",
      "rocket", "candy", "banana", "chef", "crown", "pizza",
      "soccer", "island", "notebook", "telephone", "calendar", "keychain"
    ],

    Part3: [
      "kangaroo", "microscope", "xylophone", "zebra", "volcano",
      "jellyfish", "dragonfly", "dinosaur", "telescope",
      "helicopter", "submarine", "pyramid", "lighthouse",
      "marriage", "hedgehog", "chameleon", "nightmare"
    ]
  },

  Quick: {
    Part1: [
      "baby", "elephant", "giraffe", "dolphin", "penguin",
      "alligator", "octopus", "rhinoceros", "hippopotamus",
      "crocodile", "butterfly"
    ],

    Part2: [
      "hamburger", "sushi", "donut", "spaghetti",
      "watermelon", "sandwich", "cupcake", "nachos",
      "ice cream", "taco"
    ],

    Part3: [
      "swimming", "skateboarding", "fishing",
      "running", "dancing", "singing",
      "cooking", "painting", "gardening", "climbing"
    ]
  },

  Kids: {
    Part1: [
      "laptop", "backpack", "flashlight", "umbrella",
      "headphones", "glasses"
    ],

    Part2: [
      "starship", "satellite", "space shuttle",
      "drone", "battleship", "tank"
    ],

    Part3: [
      "monster truck", "racecar",
      "ambulance", "firetruck"
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
