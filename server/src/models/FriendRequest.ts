import mongoose, { Schema, Document } from 'mongoose';

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface IFriendRequest extends Document {
  fromOpenid: string;   // 申请人
  toOpenid: string;     // 被申请人
  status: FriendRequestStatus;
  message?: string;     // 申请附言
  createTime: string;
  handledAt?: string;   // 处理时间
}

const FriendRequestSchema = new Schema<IFriendRequest>({
  fromOpenid: { type: String, required: true, index: true },
  toOpenid: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  message: { type: String, default: '' },
  createTime: { type: String, default: () => new Date().toISOString() },
  handledAt: { type: String, default: '' },
});

// 确保同一对用户同一时刻只能有一条 pending 申请
FriendRequestSchema.index({ fromOpenid: 1, toOpenid: 1, status: 1 }, { unique: true });

FriendRequestSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj._id = obj._id.toString();
  delete obj.__v;
  return obj;
};

export const FriendRequest = mongoose.model<IFriendRequest>('FriendRequest', FriendRequestSchema);
