import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useUserStore } from './store/userStore';
import { authService } from './services/authService';
import { connectSocket } from './services/socket';
import './app.scss';

// 调试服务器地址：
// - 浏览器 dev（NODE_ENV !== production）：走局域网 TRAE-debugger (7777)
// - APK（H5 生产构建）：走 ngrok 后端 /api/dev/debug/event，从任何网络都能上报
// #region debug-point H2-H4:app-boot
const DBG_URL = (process.env.TARO_ENV === 'h5' && process.env.NODE_ENV === 'production')
  ? 'https://breathless-adan-gunless.ngrok-free.dev/api/dev/debug/event'
  : 'http://192.168.0.106:7777/event';
const DBG_SID = 'apk-capacitor-runtime';
function dbgReport(hypothesisId: string, msg: string, data: any = {}) {
  try {
    fetch(DBG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: DBG_SID,
        runId: 'pre',
        hypothesisId,
        location: 'App.tsx',
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
// #endregion

function App(props) {
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    // 启动时打印运行环境
    try {
      const isNative = Capacitor.isNativePlatform();
      const loc = typeof window !== 'undefined' ? window.location?.origin : '';
      // #region debug-point H2-H4:app-boot
      (() => {
        let plat = 'unknown';
        try { plat = Capacitor.getPlatform?.() || 'unknown' } catch {}
        const loc2 = typeof window !== 'undefined' ? window.location?.origin : 'nowin';
        dbgReport('A', `App boot: Capacitor.isNativePlatform=${Capacitor.isNativePlatform()} platform=${plat} origin=${loc2}`);
      })();
      // #endregion

      if (process.env.TARO_ENV === 'weapp') {
        Taro.cloud.init({ env: '', traceUser: true });
      }
    } catch {
      /* ignore */
    }
    // 应用启动时恢复登录状态
    init().finally(() => {
      // 无论 init 是否成功，只要本地有 token，就尝试连接 Socket
      if (authService.isLoggedIn()) {
        connectSocket();
      }
    });
  }, []);

  // 监听 Android 硬件返回键：仅原生 APK 环境生效
  // - 如果当前在子页面（如 contacts/room/game）→ Taro.navigateBack 返回上一级
  // - 如果已在首页 → 退出 App（默认行为）
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const pages = Taro.getCurrentPages();
      // 页面栈 <=1 表示在首页，直接退出 App
      if (!pages || pages.length <= 1) {
        CapacitorApp.exitApp();
        return;
      }
      // 否则返回上一级页面
      Taro.navigateBack();
    });

    return () => {
      listenerPromise.then((listener) => {
        listener?.remove?.();
      }).catch(() => {});
    };
  }, []);

  useDidShow(() => {});

  useDidHide(() => {});

  return props.children;
}

export default App;
