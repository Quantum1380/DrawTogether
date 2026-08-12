import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer {
  openid: string;
  nickname: string;
  avatar: string;
  score: number;
  isReady: boolean;
  isOwner: boolean;
  status: 'online' | 'offline';
}

export interface IRoom extends Document {
  roomCode: string;
  name: string;
  owner: string;
  ownerNickname: string;
  players: IPlayer[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'ended';
  currentRound: number;
  totalRounds: number;
  /** 每轮绘画秒数（默认 60） */
  drawSeconds: number;
  currentDrawer?: string;
  currentWord?: string;
  /** 当前大回合的画者顺序（openid 数组），每位玩家轮一次才算完整回合 */
  drawerOrder: string[];
  /** 当前轮到 drawerOrder 的第几个画者（0-indexed），所有玩家轮完 -> drawerIndex = drawerOrder.length */
  drawerIndex: number;
  /** 本局用过的所有词(用于归档到 GameRecord) */
  usedWords: string[];
  /** 游戏开始时间(ISO 字符串,在 /start 接口设置) */
  startedAt: string;
  /** 游戏结束时间(ISO 字符串,整局结束时设置) */
  endedAt: string;
  createTime: string;
}

const PlayerSchema = new Schema<IPlayer>({
  openid: { type: String, required: true },
  nickname: { type: String, required: true },
  avatar: { type: String, default: '' },
  score: { type: Number, default: 0 },
  isReady: { type: Boolean, default: false },
  isOwner: { type: Boolean, default: false },
  status: { type: String, enum: ['online', 'offline'], default: 'online' },
}, { _id: false });

const RoomSchema = new Schema<IRoom>({
  roomCode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  owner: { type: String, required: true },
  ownerNickname: { type: String, required: true },
  players: { type: [PlayerSchema], default: [] },
  maxPlayers: { type: Number, default: 6 },
  status: { type: String, enum: ['waiting', 'playing', 'ended'], default: 'waiting' },
  currentRound: { type: Number, default: 0 },
  totalRounds: { type: Number, default: 3 },
  drawSeconds: { type: Number, default: 60 },
  currentDrawer: { type: String, default: '' },
  currentWord: { type: String, default: '' },
  drawerOrder: { type: [String], default: [] },
  drawerIndex: { type: Number, default: 0 },
  usedWords: { type: [String], default: [] },
  startedAt: { type: String, default: '' },
  endedAt: { type: String, default: '' },
  createTime: { type: String, default: () => new Date().toISOString() },
});

RoomSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj._id = obj._id.toString();
  delete obj.__v;
  return obj;
};

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
