const ADJECTIVES = [
  "Swift", "Crazy", "Silent", "Fierce", "Lucky",
  "Epic", "Sneaky", "Brave", "Wild", "Cool"
];

const NOUNS = [
  "Tiger", "Wolf", "Falcon", "Dragon", "Ninja",
  "Ghost", "Knight", "Wizard", "Rider", "Samurai"
];

exports.generateGuestName = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}_${num}`;
};
