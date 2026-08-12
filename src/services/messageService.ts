import { callFunction } from './cloud';

export interface InviteMessageData {
  roomId: string;
  roomCode: string;
  fromOpenid: string;
  fromNickname: string;
  fromAvatar: string;
}

export interface FriendRequestMessageData {
  requestId: string;
  fromOpenid: string;
  fromNickname: string;
  fromAvatar: string;
  message?: string;
}

export type MessageItemType = 'chat' | 'system' | 'invite' | 'friend_request';

export interface MessageItem {
  _id: string;
  fromOpenid: string;
  toOpenid: string;
  content: string;
  type: MessageItemType;
  data?: string;   // JSON 字符串
  isRead: boolean;
  createTime: string;
}

export const messageService = {
  async getMessages(): Promise<MessageItem[]> {
    return callFunction<MessageItem[]>('messages');
  },

  async markRead(messageIds: string[]): Promise<void> {
    await callFunction('messages/read', { messageIds });
  },

  /**
   * 邀请好友加入某房间（发送邀请消息）。仅发送消息，不创建房间。
   */
  async inviteFriend(toOpenid: string, roomId: string, roomCode: string): Promise<any> {
    return callFunction('messages/invite', { toOpenid, roomId, roomCode });
  },

  /**
   * 【推荐】点击「邀请」一键流程：
   * 1. 自动创建默认房间（1回合，最大6人）
   * 2. 当前用户成为房主，已加入房间
   * 3. 给好友发送邀请消息
   * 返回 { roomId, roomCode, room }
   */
  async inviteAndCreateRoom(toOpenid: string): Promise<{ roomId: string; roomCode: string; messageId: string; room: any }> {
    return callFunction('messages/invite/create-and-send', { toOpenid });
  },

  /**
   * 点击邀请消息时校验房间是否还存在。
   * - 不存在：返回 { exists: false }，前端应提示「房主已退出房间」
   * - 存在：返回 { exists: true, room }
   */
  async checkInviteRoom(roomId: string): Promise<{ exists: boolean; room: any }> {
    return callFunction(`messages/invite/check/${roomId}`, {});
  },
};
