const WORDS = {
  Classic: ["apple", "car", "house", "tree", "phone", "river", "chair"],
  Quick: ["sun", "cat", "ball", "hat"],
  Kids: ["dog", "cup", "toy"],
};

function pickRandomWords(mode, count = 3) {
  const list = WORDS[mode] || WORDS.Classic;
  const shuffled = [...list].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = {
  pickRandomWords,
};
