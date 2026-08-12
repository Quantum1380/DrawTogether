// 房间类型定义

export type RoomStatus = 'waiting' | 'playing' | 'ended';

export interface Player {
  openid: string;
  nickname: string;
  avatar: string;
  score: number;
  isReady: boolean;
  isOwner: boolean;
  status: 'online' | 'offline';
}

export interface Room {
  _id: string;
  roomCode: string;
  name: string;
  owner: string; // openid
  ownerNickname: string;
  players: Player[];
  maxPlayers: number;
  status: RoomStatus;
  currentRound: number;
  totalRounds: number;
  /** 每轮绘画秒数（默认 60） */
  drawSeconds: number;
  currentDrawer?: string; // openid of current drawer
  currentWord?: string;
  drawerOrder?: string[]; // 当次大回合的画者顺序（openid 列表）
  drawerIndex?: number;   // 当前轮到 drawerOrder 第几个
  createTime: string;
}

export interface CreateRoomParams {
  name: string;
  maxPlayers?: number;
  totalRounds?: number;
  drawSeconds?: number;
}
