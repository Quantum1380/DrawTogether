// Word bank (English)
// Keep in sync with src/types/game.ts WORD_BANK
export const WORD_BANK: string[] = [
  // Fruits
  'apple', 'banana', 'watermelon', 'strawberry', 'grape', 'pineapple', 'cherry', 'lemon',
  // Animals
  'cat', 'dog', 'rabbit', 'panda', 'tiger', 'elephant', 'giraffe', 'penguin',
  // Nature
  'sun', 'moon', 'star', 'rainbow', 'lightning', 'snowflake', 'cloud', 'tornado',
  // Electronics
  'phone', 'computer', 'television', 'camera', 'headphones', 'keyboard', 'mouse', 'watch',
  // Music
  'piano', 'guitar', 'violin', 'drums', 'harmonica', 'saxophone', 'flute', 'zither',
  // Sports
  'soccer', 'basketball', 'ping-pong', 'badminton', 'tennis', 'bowling', 'billiards', 'golf',
  // Vehicles
  'airplane', 'train', 'car', 'bicycle', 'motorcycle', 'ship', 'balloon', 'rocket',
  // Food
  'hamburger', 'pizza', 'sushi', 'noodles', 'dumpling', 'cake', 'ice cream', 'chocolate',
  // Accessories
  'umbrella', 'glasses', 'hat', 'scarf', 'gloves', 'shoes', 'backpack', 'wallet',
  // Landmarks
  'castle', 'bridge', 'lighthouse', 'windmill', 'tent', 'pyramid', 'great wall', 'eiffel tower',
  // Sea creatures
  'butterfly', 'bee', 'snail', 'crab', 'starfish', 'octopus', 'shark', 'dolphin',
  // Holidays
  'christmas tree', 'pumpkin', 'birthday cake', 'red envelope', 'firecracker', 'lantern', 'kite', 'balloon',
];

/** Pick a random word */
export function pickWord(): string {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}
