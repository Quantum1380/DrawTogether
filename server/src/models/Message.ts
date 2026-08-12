import mongoose, { Schema, Document } from 'mongoose';

/**
 * 消息类型：
 * - chat: 聊天消息（暂未实现）
 * - system: 系统通知
 * - invite: 游戏房间邀请（data 存 { roomId, roomCode }）
 * - friend_request: 好友申请（data 存 { requestId }）
 */
export type MessageType = 'chat' | 'system' | 'invite' | 'friend_request';

export interface IMessage extends Document {
  fromOpenid: string;
  toOpenid: string;
  content: string;    // 文本展示内容
  type: MessageType;
  /**
   * JSON 字符串，根据 type 不同存不同数据：
   * - invite: { roomId, roomCode, fromNickname }
   * - friend_request: { requestId, fromNickname, fromAvatar, message }
   */
  data?: string;
  isRead: boolean;
  createTime: string;
}

const MessageSchema = new Schema<IMessage>({
  fromOpenid: { type: String, required: true, index: true },
  toOpenid: { type: String, required: true, index: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['chat', 'system', 'invite', 'friend_request'], default: 'chat' },
  data: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  createTime: { type: String, default: () => new Date().toISOString() },
});

MessageSchema.index({ toOpenid: 1, isRead: 1 });

MessageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj._id = obj._id.toString();
  delete obj.__v;
  return obj;
};

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
