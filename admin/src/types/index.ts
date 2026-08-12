// 管理员
export interface Admin {
  _id: string;
  username: string;
  nickname: string;
  role: "super" | "admin";
  lastLoginAt: string;
  createTime: string;
}

// 封禁状态
export interface BanStatus {
  banned: boolean;
  banReason: string;
  bannedAt: string;
  bannedBy: string;
}

// 玩家
export interface Player {
  _id: string;
  openid: string;
  username: string;
  nickname: string;
  avatar: string;
  phone: string;
  status: "online" | "offline" | "busy";
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  banStatus: BanStatus;
  createTime: string;
}

// 对局玩家快照
export interface GamePlayerSnapshot {
  openid: string;
  nickname: string;
  avatar: string;
  score: number;
}

// 对局记录
export interface GameRecord {
  _id: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  players: GamePlayerSnapshot[];
  totalRounds: number;
  winner: { openid: string; nickname: string } | null;
  words: string[];
  startTime: string;
  endTime: string;
  createTime: string;
}

// 房间
export interface Room {
  _id: string;
  roomCode: string;
  name: string;
  owner: string;
  ownerNickname: string;
  players: any[];
  maxPlayers: number;
  status: "waiting" | "playing" | "ended";
  currentRound: number;
  totalRounds: number;
  /** 每轮绘画秒数（默认 60） */
  drawSeconds: number;
  currentDrawer?: string;
  currentWord?: string;
  drawerOrder?: string[];
  drawerIndex?: number;
  usedWords?: string[];
  startedAt: string;
  endedAt: string;
  createTime: string;
}

// 联系人
export interface ContactItem {
  name: string;
  phone: string;
  registered: boolean;
  registeredOpenid: string;
  registeredAvatar: string;
}

// 用户联系人快照
export interface UserContactsData {
  synced: boolean;
  contacts: ContactItem[];
  total: number;
  registeredCount: number;
  syncTime: string;
}

// 好友信息（带用户基本信息 + 添加时间）
export interface FriendInfo {
  _id: string;
  openid: string;
  username: string;
  nickname: string;
  avatar: string;
  phone: string;
  status: "online" | "offline" | "busy";
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  banStatus: BanStatus;
  createTime: string;
  addedAt: string;
}

// 用户好友列表数据
export interface UserFriendsData {
  total: number;
  onlineCount: number;
  friends: FriendInfo[];
}

// 统计数据
export interface Stats {
  totalPlayers: number;
  onlinePlayers: number;
  todayNewPlayers: number;
  totalGames: number;
  todayGames: number;
  totalBanned: number;
}

// 分页响应
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// API 响应
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}
