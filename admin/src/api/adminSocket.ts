import { io, Socket } from 'socket.io-client';
import { tokenStorage } from '@/api/request';

// ============================================================
// 管理后台专属 Socket 连接
// - 只在有 admin token 时才连接（登录成功后）
// - token 过期/清空时自动断开
// ============================================================

export type AdminSocketStatus = 'disconnected' | 'connecting' | 'connected';

const listeners = new Set<(status: AdminSocketStatus) => void>();

let socket: Socket | null = null;
let _status: AdminSocketStatus = 'disconnected';

function setStatus(s: AdminSocketStatus) {
  if (_status === s) return;
  _status = s;
  listeners.forEach((fn) => {
    try { fn(s); } catch (err) { console.error('[adminSocket] status listener error:', err); }
  });
}

/** 拼出 socket 服务地址：开发模式下走 vite 代理不可用（ws 不走 HTTP 代理），直接连后端 origin */
function resolveSocketUrl(): string {
  // 如果已在同源部署（同域下 nginx 把 /socket.io 转发到 node），优先走同源
  if (import.meta.env.PROD) return window.location.origin;
  // 开发模式：vite 的 http://localhost:10088 → 代理到 http://localhost:3000
  // 这里直接连 3000，避免配置 ws 代理
  return 'http://localhost:3000';
}

/**
 * 初始化管理后台 socket 连接。重复调用幂等。
 * - 如果已经初始化过，仅返回现有实例
 * - 没有 token 时不会连接，返回 null
 */
export function ensureAdminSocket(): Socket | null {
  const token = tokenStorage.get();
  if (!token) {
    disconnectAdminSocket();
    return null;
  }
  if (socket && socket.connected) return socket;

  try {
    setStatus('connecting');
    socket = io(resolveSocketUrl(), {
      // 避免与玩家端 socket 冲突
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      setStatus('connected');
      console.log('[adminSocket] connected');
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      console.log('[adminSocket] disconnected:', reason);
      // token 失效：服务端主动踢，清 token
      if (reason === 'io server disconnect') {
        tokenStorage.clear();
        if (!location.hash.startsWith('#/login')) location.hash = '#/login';
      }
    });

    socket.on('connect_error', (err) => {
      // 鉴权失败（Token 无效），清 token 跳登录
      const msg = (err && (err as any).message) ? String((err as any).message) : '';
      if (/Token 无效|未登录|Token 类型错误|401/i.test(msg)) {
        tokenStorage.clear();
        if (!location.hash.startsWith('#/login')) location.hash = '#/login';
        try { socket?.disconnect(); } catch (_) { /* noop */ }
        socket = null;
      }
      console.warn('[adminSocket] connect_error:', msg || err?.message);
    });

    socket.on('admin:connected', (data) => {
      console.log('[adminSocket] admin:connected:', data);
    });

    return socket;
  } catch (err) {
    console.error('[adminSocket] init error:', err);
    setStatus('disconnected');
    return null;
  }
}

/** 断开 admin socket 连接 */
export function disconnectAdminSocket(): void {
  if (socket) {
    try { socket.disconnect(); } catch (_) { /* noop */ }
    socket = null;
  }
  setStatus('disconnected');
}

/** 订阅连接状态变化，返回取消订阅函数 */
export function subscribeAdminSocketStatus(cb: (status: AdminSocketStatus) => void): () => void {
  listeners.add(cb);
  cb(_status);
  return () => listeners.delete(cb);
}

/** 获取当前连接状态 */
export function getAdminSocketStatus(): AdminSocketStatus {
  return _status;
}
