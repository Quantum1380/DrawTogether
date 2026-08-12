import { useEffect, useRef } from 'react';
import { ensureAdminSocket } from '@/api/adminSocket';

/**
 * 确保当前页面挂载期间，管理后台 socket 已连接，并订阅一组事件。
 * 组件卸载时自动取消订阅。
 *
 * 参数 events 以事件名为 key，value 为 handler，避免 useEffect 依赖抖动
 */
export function useAdminSocketEvents(events: Record<string, (...args: any[]) => void>) {
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    const socket = ensureAdminSocket();
    if (!socket) return;

    const offFns: Array<() => void> = [];
    Object.keys(handlersRef.current).forEach((evt) => {
      const wrapper = (...args: any[]) => {
        const fn = handlersRef.current[evt];
        if (typeof fn === 'function') fn(...args);
      };
      socket.on(evt, wrapper);
      offFns.push(() => socket.off(evt, wrapper));
    });

    return () => offFns.forEach((fn) => fn());
  }, []);
}
