import mongoose, { Schema, Document } from 'mongoose';

export interface IUserContact extends Document {
  openid: string;
  contacts: {
    name: string;
    phone: string;
    registered: boolean;
    registeredOpenid: string;
    registeredAvatar: string;
  }[];
  total: number;
  registeredCount: number;
  syncTime: string;
}

const ContactItemSchema = new Schema(
  {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    registered: { type: Boolean, default: false },
    registeredOpenid: { type: String, default: '' },
    registeredAvatar: { type: String, default: '' },
  },
  { _id: false }
);

const UserContactSchema = new Schema<IUserContact>({
  openid: { type: String, required: true, index: true },
  contacts: { type: [ContactItemSchema], default: [] },
  total: { type: Number, default: 0 },
  registeredCount: { type: Number, default: 0 },
  syncTime: { type: String, default: () => new Date().toISOString() },
});

// 一个用户只保留一份最新通讯录快照
UserContactSchema.index({ openid: 1 }, { unique: true });

export const UserContact = mongoose.model<IUserContact>('UserContact', UserContactSchema);
