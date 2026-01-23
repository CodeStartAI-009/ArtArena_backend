const WORDS = {
  Classic: [
    "apple", "car", "house", "tree", "phone", "river", "chair",
    "book", "road", "window", "mountain", "table", "clock", "bridge"
  ],
  
  Quick: [
    "sun", "cat", "ball", "hat",
    "pen", "star", "shoe", "box", "fish", "moon"
  ],
  
  Kids: [
    "dog", "cup", "toy", "cat", "bat",
    "duck", "car", "ball", "cow", "hat", "bed", "sun"
  ]
  
};

function pickRandomWords(mode, count = 3) {
  const list = WORDS[mode] || WORDS.Classic;
  const shuffled = [...list].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = {
  pickRandomWords,
};
