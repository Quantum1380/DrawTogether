// 消息类型定义

export type MessageType = 'invite' | 'system' | 'friend';

export interface Message {
  _id: string;
  type: MessageType;
  fromOpenid: string;
  fromNickname: string;
  fromAvatar: string;
  toOpenid: string;
  content: string;
  roomId?: string;
  roomCode?: string;
  read: boolean;
  createTime: string;
}
