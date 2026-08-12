import mongoose, { Schema, Document } from 'mongoose';

export interface IGamePlayerSnapshot {
  openid: string;
  nickname: string;
  avatar: string;
  score: number;
}

export interface IGameRecord extends Document {
  roomId: string;
  roomCode: string;
  roomName: string;
  players: IGamePlayerSnapshot[];
  totalRounds: number;
  winner: { openid: string; nickname: string } | null;
  words: string[];
  startTime: string;
  endTime: string;
  createTime: string;
}

const GamePlayerSnapshotSchema = new Schema<IGamePlayerSnapshot>(
  {
    openid: { type: String, required: true },
    nickname: { type: String, required: true },
    avatar: { type: String, default: '' },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const GameRecordSchema = new Schema<IGameRecord>({
  roomId: { type: String, required: true, index: true },
  roomCode: { type: String, required: true, index: true },
  roomName: { type: String, required: true },
  players: { type: [GamePlayerSnapshotSchema], default: [] },
  totalRounds: { type: Number, default: 0 },
  winner: {
    openid: { type: String, default: '' },
    nickname: { type: String, default: '' },
  },
  words: { type: [String], default: [] },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  createTime: { type: String, default: () => new Date().toISOString() },
});

GameRecordSchema.index({ endTime: -1 });
GameRecordSchema.index({ roomCode: 1 });

GameRecordSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj._id = obj._id.toString();
  delete obj.__v;
  return obj;
};

export const GameRecord = mongoose.model<IGameRecord>('GameRecord', GameRecordSchema);
