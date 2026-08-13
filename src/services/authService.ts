import Taro from '@tarojs/taro';
import { callFunction, setToken, clearToken, getToken, isLoggedIn } from './cloud';
import { connectSocket, disconnectSocket } from './socket';
import type { UserProfile } from '@/types/user';

export interface LoginResult {
  token: string;
  user: UserProfile;
}

export const authService = {
  /** 注册（手机号） */
  async register(phone: string, password: string, nickname?: string): Promise<LoginResult> {
    const data = await callFunction<LoginResult>('auth/register', {
      phone,
      password,
      nickname,
    });
    await setToken(data.token);
    connectSocket();
    return data;
  },

  /** 登录（手机号+密码） */
  async login(phone: string, password: string): Promise<LoginResult> {
    const data = await callFunction<LoginResult>('auth/login', {
      phone,
      password,
    });
    await setToken(data.token);
    connectSocket();
    return data;
  },

  /** 退出登录 */
  async logout(): Promise<void> {
    try {
      await callFunction('auth/logout', {});
    } finally {
      clearToken();
      disconnectSocket();
    }
  },

  /** 获取当前用户信息 */
  async getProfile(): Promise<UserProfile> {
    return callFunction<UserProfile>('auth/profile');
  },

  getToken,
  isLoggedIn,
};
