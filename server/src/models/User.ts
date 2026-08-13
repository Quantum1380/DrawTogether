import mongoose, { Schema, Document } from 'mongoose';

export interface IBanStatus {
  banned: boolean;
  banReason: string;
  bannedAt: string;
  bannedBy: string;
}

export interface IUser extends Document {
  openid: string;
  username: string;
  password: string;
  nickname: string;
  avatar: string;
  phone: string;
  status: 'online' | 'offline' | 'busy';
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  banStatus: IBanStatus;
  createTime: string;
}

const BanStatusSchema = new Schema<IBanStatus>(
  {
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: String, default: '' },
    bannedBy: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * 生成 6 位 UID（0-9, A-Z 共 36 进制，排除易混字符 I O）
 * 用例：A3F9KQ、B7X2M1
 */
const UID_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 34 个字符（去掉 I O）
export function generateUid(length = 6): string {
  let uid = '';
  const arr = new Uint8Array(length);
  // 优先使用 crypto，不可用则降级到 Math.random
  try {
    (global as any).crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      uid += UID_ALPHABET[arr[i] % UID_ALPHABET.length];
    }
  } catch {
    for (let i = 0; i < length; i++) {
      uid += UID_ALPHABET[Math.floor(Math.random() * UID_ALPHABET.length)];
    }
  }
  return uid;
}

/**
 * 生成不重复的 6 位 UID（最多重试 10 次）
 * 6 位 34 进制约 14 亿种组合，常规应用足够；
 * 万一碰撞，重试即可。若仍冲突，则降级到 8 位。
 */
export async function generateUniqueUid(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const uid = generateUid(6);
    const exists = await User.exists({ openid: uid });
    if (!exists) return uid;
  }
  // 极端情况：6 位连续碰撞，降级到 8 位
  return generateUid(8);
}

const UserSchema = new Schema<IUser>({
  openid: { type: String, required: true, unique: true },
  // username 自动设为 UID（openid），不再由用户输入
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  nickname: { type: String, required: true, trim: true, maxlength: 20 },
  avatar: { type: String, default: '' },
  phone: { type: String, required: true, unique: true, trim: true },
  status: { type: String, enum: ['online', 'offline', 'busy'], default: 'offline' },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  banStatus: { type: BanStatusSchema, default: () => ({ banned: false, banReason: '', bannedAt: '', bannedBy: '' }) },
  createTime: { type: String, default: () => new Date().toISOString() },
});

UserSchema.index({ 'banStatus.banned': 1 });

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);
