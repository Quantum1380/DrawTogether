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

// 词语库
export const WORD_BANK: string[] = [
  '苹果', '香蕉', '西瓜', '草莓', '葡萄', '菠萝', '樱桃', '柠檬',
  '猫咪', '小狗', '兔子', '熊猫', '老虎', '大象', '长颈鹿', '企鹅',
  '太阳', '月亮', '星星', '彩虹', '闪电', '雪花', '云朵', '龙卷风',
  '手机', '电脑', '电视', '相机', '耳机', '键盘', '鼠标', '手表',
  '钢琴', '吉他', '小提琴', '架子鼓', '口琴', '萨克斯', '笛子', '古筝',
  '足球', '篮球', '乒乓球', '羽毛球', '网球', '保龄球', '台球', '高尔夫',
  '飞机', '火车', '汽车', '自行车', '摩托车', '轮船', '热气球', '火箭',
  '汉堡', '披萨', '寿司', '面条', '饺子', '蛋糕', '冰淇淋', '巧克力',
  '雨伞', '眼镜', '帽子', '围巾', '手套', '鞋子', '背包', '钱包',
  '城堡', '桥梁', '灯塔', '风车', '帐篷', '金字塔', '长城', '埃菲尔铁塔',
  '蝴蝶', '蜜蜂', '蜗牛', '螃蟹', '海星', '章鱼', '鲨鱼', '海豚',
  '圣诞树', '南瓜灯', '生日蛋糕', '红包', '鞭炮', '灯笼', '风筝', '气球'
];
