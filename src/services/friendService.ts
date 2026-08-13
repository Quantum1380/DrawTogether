import { callFunction } from './cloud';
import type { Friend, Contact } from '@/types/user';

export interface SearchUser {
  openid: string;
  nickname: string;
  avatar: string;
  phone: string;
  status: string;  // online | offline
  isFriend: boolean;
  hasRequested: boolean; // 是否已发送 pending 好友申请
}

export interface FriendRequestItem {
  _id: string;
  requestId: string;
  fromOpenid: string;
  fromNickname: string;
  fromAvatar: string;
  fromUsername: string;
  message: string;
  createTime: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export const friendService = {
  async getFriends(): Promise<Friend[]> {
    return callFunction<Friend[]>('friends');
  },

  async getOnlineStatus(openids: string[]): Promise<Record<string, string>> {
    return callFunction<Record<string, string>>('friends/online-status', { openids });
  },

  async syncContacts(contacts: { name: string; phone: string }[]): Promise<Contact[]> {
    return callFunction<Contact[]>('friends/sync-contacts', { contacts });
  },

  async addFriend(openid: string): Promise<void> {
    await callFunction('friends/add', { openid });
  },

  async searchUsers(keyword: string): Promise<SearchUser[]> {
    return callFunction<SearchUser[]>('friends/search', { keyword });
  },

  /**
   * 发送好友申请（单向申请，需要对方同意）
   */
  async sendFriendRequest(toOpenid: string, message?: string): Promise<{ requestId: string }> {
    return callFunction('friends/request', { toOpenid, message: message || '' });
  },

  /**
   * 我收到的好友申请列表（pending 状态）
   */
  async getIncomingFriendRequests(): Promise<FriendRequestItem[]> {
    return callFunction<FriendRequestItem[]>('friends/requests/incoming');
  },

  /**
   * 同意好友申请
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    await callFunction(`friends/requests/${requestId}/accept`, {});
  },

  /**
   * 拒绝好友申请
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    await callFunction(`friends/requests/${requestId}/reject`, {});
  },
};
