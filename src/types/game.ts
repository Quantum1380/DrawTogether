// 游戏类型定义

export type GamePhase = 'waiting' | 'drawing' | 'roundEnd' | 'gameEnd';

export interface DrawStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  openid: string;
  nickname: string;
  avatar: string;
  content: string;
  type: 'chat' | 'system' | 'correct' | 'close';
  createTime: string;
}

export interface GameRound {
  roundIndex: number;
  drawer: string; // openid
  word: string;
  startTime: number;
  duration: number; // seconds
  guessers: string[]; // openids who guessed correctly
}

export interface GameResult {
  roomId: string;
  players: { openid: string; nickname: string; avatar: string; score: number }[];
  duration: number;
  createTime: string;
}

// Word bank (English)
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
  'christmas tree', 'pumpkin', 'birthday cake', 'red envelope', 'firecracker', 'lantern', 'kite', 'balloon'
];
