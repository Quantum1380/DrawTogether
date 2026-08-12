import mongoose, { Schema, Document } from 'mongoose';

export interface IFriend extends Document {
  openid: string;
  friendOpenid: string;
  createTime: string;
}

const FriendSchema = new Schema<IFriend>({
  openid: { type: String, required: true, index: true },
  friendOpenid: { type: String, required: true, index: true },
  createTime: { type: String, default: () => new Date().toISOString() },
});

FriendSchema.index({ openid: 1, friendOpenid: 1 }, { unique: true });

export const Friend = mongoose.model<IFriend>('Friend', FriendSchema);
