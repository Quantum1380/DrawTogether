// 用户类型定义

export type UserStatus = 'online' | 'offline' | 'busy';

export interface UserProfile {
  openid: string;
  nickname: string;
  avatar: string;
  phone: string;
  status: UserStatus;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  createTime: string;
}

// 好友信息
export interface Friend extends UserProfile {
  remark?: string; // 备注
}

// 通讯录联系人
export interface Contact {
  name: string;
  phone: string;
  registered: boolean; // 是否已注册
  avatar?: string;
  openid?: string;
}
