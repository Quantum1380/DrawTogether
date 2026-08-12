import Taro from '@tarojs/taro';
import { callFunction, setToken, clearToken, getToken, isLoggedIn } from './cloud';
import { connectSocket, disconnectSocket } from './socket';
import type { UserProfile } from '@/types/user';

export interface LoginResult {
  token: string;
  user: UserProfile;
}

export const authService = {
  /** 注册 */
  async register(username: string, password: string, nickname?: string): Promise<LoginResult> {
    const data = await callFunction<LoginResult>('auth/register', {
      username,
      password,
      nickname,
    });
    // ⚠️ 必须等待 token 落盘到 Preferences，否则用户立即退出 App 会丢登录态
    await setToken(data.token);
    connectSocket();
    return data;
  },

  /** 登录 */
  async login(username: string, password: string): Promise<LoginResult> {
    const data = await callFunction<LoginResult>('auth/login', {
      username,
      password,
    });
    // ⚠️ 必须等待 token 落盘到 Preferences，否则用户立即退出 App 会丢登录态
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
