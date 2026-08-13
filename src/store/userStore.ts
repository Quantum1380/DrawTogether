import { create } from 'zustand';
import type { UserProfile } from '@/types/user';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { preloadToken } from '@/services/cloud';

interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  loggedIn: boolean;
  hasToken: boolean; // 本地是否有 token（用于 UI 闪烁判断）
  init: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkLogin: () => boolean;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  loading: false,
  loggedIn: false,
  hasToken: false,

  /**
   * 应用启动时调用：
   * 1. 先从原生 Preferences 异步预读到内存（仅原生环境需要，浏览器直接读 localStorage）
   * 2. 检查本地是否有 token，有则先标记为已登录（避免 UI 闪烁）
   * 3. 异步获取用户信息验证 token 有效性
   * 4. 如果 token 无效（401），清除 token 并重置状态
   */
  init: async () => {
    // 必须先 await preloadToken()，把原生 SharedPreferences 里的 token 读到内存
    await preloadToken();
    const token = authService.getToken();
    if (token) {
      // 先假设已登录，避免 UI 先显示未登录再跳转到登录页
      set({ hasToken: true, loggedIn: true, loading: true });
      try {
        const profile = await userService.getUserProfile();
        set({ profile, loggedIn: !!profile, loading: false });
      } catch (err: any) {
        console.error('[UserStore] init fetchUserProfile error:', err);
        // 如果是 401 或未授权，清除 token
        if (err?.message?.includes('未登录') || err?.message?.includes('token') || err?.message?.includes('401')) {
          console.warn('[UserStore] token invalid, clearing');
          authService.logout().catch(() => {});
          set({ profile: null, loggedIn: false, hasToken: false, loading: false });
        } else {
          // 网络错误等其他情况，保留登录状态，用户下拉刷新或重新进入时再试
          set({ loading: false });
        }
      }
    } else {
      set({ hasToken: false, loggedIn: false, profile: null, loading: false });
    }
  },

  fetchUserProfile: async () => {
    set({ loading: true });
    try {
      const profile = await userService.getUserProfile();
      set({ profile, loggedIn: !!profile, hasToken: !!profile, loading: false });
    } catch (err) {
      console.error('[UserStore] fetchUserProfile error:', err);
      set({ loading: false });
    }
  },

  updateProfile: async (data) => {
    try {
      await userService.updateProfile(data);
      set((state) => ({
        profile: state.profile ? { ...state.profile, ...data } : null,
      }));
    } catch (err) {
      console.error('[UserStore] updateProfile error:', err);
    }
  },

  setProfile: (profile) => set({ profile, loggedIn: !!profile }),

  login: async (phone, password) => {
    const { user } = await authService.login(phone, password);
    set({ profile: user, loggedIn: true });
  },

  register: async (phone, password, nickname) => {
    const { user } = await authService.register(phone, password, nickname);
    set({ profile: user, loggedIn: true });
  },

  logout: async () => {
    await authService.logout();
    set({ profile: null, loggedIn: false });
  },

  checkLogin: () => {
    return get().loggedIn || authService.isLoggedIn();
  },
}));
