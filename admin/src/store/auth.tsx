import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminApi } from '@/api';
import { tokenStorage } from '@/api/request';
import { ensureAdminSocket, disconnectAdminSocket, subscribeAdminSocketStatus, AdminSocketStatus } from '@/api/adminSocket';
import type { Admin } from '@/types';

interface AuthContextValue {
  admin: Admin | null;
  loading: boolean;
  socketStatus: AdminSocketStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketStatus, setSocketStatus] = useState<AdminSocketStatus>('disconnected');

  // 订阅 admin socket 连接状态（用于 UI 提示）
  useEffect(() => subscribeAdminSocketStatus(setSocketStatus), []);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      disconnectAdminSocket();
      return;
    }
    adminApi
      .getProfile()
      .then((a) => {
        setAdmin(a);
        // 登录态有效 → 启动 admin socket
        ensureAdminSocket();
      })
      .catch(() => {
        tokenStorage.clear();
        disconnectAdminSocket();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { token, admin } = await adminApi.login(username, password);
    tokenStorage.set(token);
    setAdmin(admin);
    // 登录成功 → 启动 admin socket（所有管理页面都能实时收到）
    ensureAdminSocket();
  };

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // 忽略后端错误
    }
    tokenStorage.clear();
    setAdmin(null);
    // 退出登录 → 立即断开 socket，避免继续接收
    disconnectAdminSocket();
  };

  return (
    <AuthContext.Provider value={{ admin, loading, socketStatus, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
