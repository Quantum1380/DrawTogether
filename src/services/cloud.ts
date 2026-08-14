import Taro from '@tarojs/taro';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// 调试上报已禁用（之前用于 192.168.0.106:7777/event 的跨域调试）
function dbgReport(_hypothesisId: string, _msg: string, _data?: any) { /* no-op */ }

const isH5 = process.env.TARO_ENV === 'h5';
const isRn = process.env.TARO_ENV === 'rn';

// ============================================================
// 后端 API / Socket 地址配置
// - H5 开发环境：通过 devServer 代理转发到本地 3000（相对路径 /api）
// - H5 生产构建（Capacitor 打 APK 时）：会以 file:// 或 https://localhost 运行，
//   必须用绝对公网地址，不能再走 /api 相对路径
// - 小程序 / RN（安卓/iOS App）：必须填真实公网地址
// ============================================================
// ⚠️ 打 APK 前必改：填你的后端真实公网地址
// - 有域名 + 配了 SSL：用 https:// 前缀（推荐）
// - 当前阶段只用服务器公网 IP：用 http://，
//   AndroidManifest.xml 已配置 usesCleartextTraffic=true 兜底；
//   APK 的 CapacitorHttp 原生请求也不会受 WebView 明文限制
const PUBLIC_SERVER = 'https://45.61.170.36';

// H5 生产模式（NODE_ENV=production，比如 cap copy 内置到 APK）也要走绝对地址
const isH5Prod = isH5 && process.env.NODE_ENV === 'production';

const API_BASE = isH5 && !isH5Prod
  ? '/api'                       // H5 开发：走 devServer 代理
  : `${PUBLIC_SERVER}/api`;      // 其它：绝对公网地址

export const SOCKET_SERVER = isH5 && !isH5Prod
  ? ''                            // H5 开发：同源走相对 /socket.io
  : PUBLIC_SERVER;                // 其它：绝对地址

const TOKEN_KEY = 'draw_token';

// 是否在 Capacitor 原生环境（APK 内）
// #region debug-point H2:cloud-isNative
let isNative: boolean;
try {
  isNative = Capacitor.isNativePlatform();
  dbgReport('B', `Module load: Capacitor.isNativePlatform=${isNative} platform=${Capacitor.getPlatform?.() || 'n/a'} TARO_ENV=${process.env.TARO_ENV} NODE_ENV=${process.env.NODE_ENV} API_BASE=${API_BASE}`);
} catch (e) {
  isNative = false;
  dbgReport('B', `Module load: Capacitor call FAILED err=${e}`);
}
// #endregion

// Preferences 是异步的，但 Taro.setStorageSync 是同步的
// 为了对外保持同步 API（getToken 是同步的），在 APK 内启动时预热：把 Preferences 里的 token
// 一次性读到内存里，后续 getToken 直接读内存，setToken 同时写内存 + Preferences（异步）
let memoryToken: string | null = null;
let preloaded = false;

/** 启动时调用：把原生 Preferences 里的 token 预读到内存 */
export async function preloadToken(): Promise<void> {
  if (preloaded) return;
  preloaded = true;
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key: TOKEN_KEY });
      memoryToken = value || '';
      // #region debug-point H1:preloadToken-native
      dbgReport('C', `preloadToken native Preferences.get got token=${!!memoryToken} len=${memoryToken?.length || 0}`);
      // #endregion
    } else if (typeof window !== 'undefined' && window.localStorage) {
      memoryToken = window.localStorage.getItem(TOKEN_KEY) || '';
      // #region debug-point H2:preloadToken-browser
      dbgReport('C', `preloadToken browser localStorage got token=${!!memoryToken} len=${memoryToken?.length || 0}`);
      // #endregion
    }
  } catch (e) {
    console.error('[Cloud] preloadToken error:', e);
    // #region debug-point H1:preloadToken-err
    dbgReport('C', `preloadToken FAILED err=${e}`);
    // #endregion
  }
}

/** 读取本地存储的 token */
export function getToken(): string {
  // 1. 优先返回内存中的 token（最快）
  if (memoryToken) return memoryToken;

  // 2. 浏览器开发环境：直接读 localStorage
  if (!isNative) {
    try {
      const token = Taro.getStorageSync(TOKEN_KEY);
      if (token) {
        memoryToken = token;
        return token;
      }
    } catch (e) {
      console.error('[Cloud] getToken Taro error:', e);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const lsToken = window.localStorage.getItem(TOKEN_KEY);
      if (lsToken) {
        memoryToken = lsToken;
        return lsToken;
      }
    }
    return '';
  }

  // 3. 原生环境：内存里没有就尝试 localStorage 兜底（极少数情况）
  if (typeof window !== 'undefined' && window.localStorage) {
    const lsToken = window.localStorage.getItem(TOKEN_KEY);
    if (lsToken) {
      memoryToken = lsToken;
      return lsToken;
    }
  }
  return '';
}

/**
 * 保存 token（原生：内存 + localStorage + Preferences 三写）
 *
 * ⚠️ 必须是 async 且 await Preferences.set：
 * - 原生 APK 的 WebView localStorage 在 App 被杀后可能丢失，
 *   只有 Preferences（基于 Android SharedPreferences）才是真正持久化的。
 * - 如果不 await，登录后用户立刻退出 App 时 Preferences.set 可能尚未完成 → 下次启动需要重新登录。
 * 因此调用方（authService.login/register）必须 `await setToken(...)`。
 */
export async function setToken(token: string): Promise<void> {
  memoryToken = token;
  // #region debug-point H1:setToken-entry
  dbgReport('C', `setToken isNative=${isNative} tokenLen=${token?.length || 0}`);
  // #endregion

  // 1. localStorage（同步写，浏览器 / WebView 兜底；APK 不能只靠它）
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.error('[Cloud] setToken localStorage error:', e);
    }
  }
  // 2. Taro storage（H5 开发用，同步）
  if (!isNative) {
    try {
      Taro.setStorageSync(TOKEN_KEY, token);
    } catch (e) {
      console.error('[Cloud] setToken Taro error:', e);
    }
  }
  // 3. 原生 Preferences（必须 await 落盘，APK 唯一可靠持久化）
  if (isNative) {
    try {
      await Preferences.set({ key: TOKEN_KEY, value: token });
      // #region debug-point H1:setToken-pref-ok
      dbgReport('C', `setToken Preferences.set OK (awaited)`);
      // #endregion
    } catch (e) {
      console.error('[Cloud] setToken Preferences error:', e);
      // #region debug-point H1:setToken-pref-err
      dbgReport('C', `setToken Preferences.set FAILED err=${e}`);
      // #endregion
      // 即使 Preferences 失败也不抛出：localStorage 已经写了，
      // 当前会话仍可用，只是下次启动可能要重新登录
    }
  }
}

/** 清除 token */
export function clearToken() {
  memoryToken = null;
  if (isNative) {
    Preferences.remove({ key: TOKEN_KEY }).catch((e) =>
      console.error('[Cloud] clearToken Preferences error:', e)
    );
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.error('[Cloud] clearToken localStorage error:', e);
    }
  }
  if (!isNative) {
    try {
      Taro.removeStorageSync(TOKEN_KEY);
    } catch (e) {
      console.error('[Cloud] clearToken Taro error:', e);
    }
  }
}

/** 判断是否已登录 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 是否连接真实后端
 * APK 打包模式下必须是 true，已强制开启；保留该变量仅用于兼容旧代码引用
 */
const useRealApi = true;

/**
 * 调用后端 API
 * - 路由映射：前端接口名 -> 后端 URL
 * - GET / POST 判断规则同上
 */
export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  const token = getToken();
  // 路由映射：前端接口名 -> 后端 URL
  const routeMap: Record<string, string> = {
    getRooms: 'rooms',  // 房间列表
  };
  const path = routeMap[name] || name;
  const url = `${API_BASE}/${path}`;
  // GET 接口列表（仅查询类）；其余用 POST
  const getEndpoints = [
    'auth/profile',
    'friends',
    'friends/search',
    'friends/requests/incoming',
    'messages',
    'getRooms',
  ];
  // 以 get 开头的接口名走 GET；rooms/:id、messages/invite/check/:roomId 这类详情查询也走 GET
  // dev/contacts-permission 是 GET（读取授权状态，POST 用于设置）
  const isGetMethod = getEndpoints.includes(name)
    || name.startsWith('get')
    || name === 'dev/contacts-permission'
    || /^rooms\/[0-9a-fA-F]{24}$/.test(name)
    || /^messages\/invite\/check\/[0-9a-fA-F]{24}$/.test(name);

  // #region debug-point H3-H4:callFunction-entry
  dbgReport('D', `callFunction [${name}] request method=${isGetMethod ? 'GET' : 'POST'} url=${url} token=${!!token} origin=${typeof window !== 'undefined' ? window.location.origin : 'n/a'}`);
  // #endregion

  try {
    // ======================================================
    // 请求实现分两条线：
    // 1) 原生环境（APK，isNative=true）：
    //    CapacitorHttp 已经 patch 了全局 fetch → 直接用原生 fetch 发请求，
    //    绕过 Taro.request 内部 whatwg-fetch + 响应封装链，避免响应结构错位
    //    （CapacitorHttp 返回格式 {data,status,headers} vs Taro 期望 {data,statusCode,header}）
    // 2) 浏览器 / H5 dev（isNative=false）：保持 Taro.request 原路径不变
    // ======================================================
    let res: { statusCode: number; header: Record<string, string>; data: any };

    if (isNative && typeof (window as any).fetch === 'function') {
      dbgReport('D2', `[${name}] use NATIVE fetch (CapacitorHttp patched) method=${isGetMethod ? 'GET' : 'POST'}`);
      // —— 构造 fetch init ——
      let reqUrl = url;
      const fetchInit: RequestInit = {
        method: isGetMethod ? 'GET' : 'POST',
        credentials: 'omit', // 原生 HTTP 不使用 cookie 鉴权（用 Bearer Token header）
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };
      // GET/HEAD：把 data serialize 到 query string（保持与 Taro.request 一致）
      if (isGetMethod && data && Object.keys(data).length > 0) {
        const qs = Object.keys(data)
          .filter(k => data[k] !== undefined && data[k] !== null)
          .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(data[k]))}`)
          .join('&');
        if (qs) reqUrl += (reqUrl.includes('?') ? '&' : '?') + qs;
      } else if (typeof data === 'object') {
        fetchInit.body = JSON.stringify(data || {});
      }

      const response = await fetch(reqUrl, fetchInit);
      const httpStatus = response.status;
      const headerOut: Record<string, string> = {};
      response.headers.forEach((v, k) => { headerOut[k] = v; });

      // 解析 body：优先 JSON，失败则回退 text
      let bodyData: any = null;
      // 204 No Content 没有 body
      if (httpStatus !== 204) {
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            bodyData = await response.json();
          } else {
            bodyData = await response.text();
          }
        } catch (_parseErr) {
          try { bodyData = await response.text(); } catch { bodyData = null; }
        }
      }

      res = { statusCode: httpStatus, header: headerOut, data: bodyData };
    } else {
      dbgReport('D2', `[${name}] use TARO.request method=${isGetMethod ? 'GET' : 'POST'} isNative=${isNative}`);
      res = await Taro.request({
        url,
        method: isGetMethod ? 'GET' : 'POST',
        data: data || {},
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    }

    // HTTP 层错误（例如 ngrok 502 / 504 / 404）
    // Taro.request / 原生 fetch 都统一到：statusCode 在 res.statusCode 上
    const httpStatus = (res as any)?.statusCode || 0;

    // ✅ 详细 dump 整个响应对象结构（CapacitorHttp vs Taro.request 兼容性排查用）
    // - 原生浏览器/H5 dev：Taro.request 返回 { statusCode, header, data(解析后JSON) }
    // - CapacitorHttp patch fetch 后：可能返回的结构是 { status, data(原生解析), headers }
    //   或 Taro.request 二次解析后造成 data 错位。这里把"自有枚举属性+keys+类型"全部打出来。
    try {
      const resKeys = Object.keys(res || {});
      const resTyped: any = {};
      for (const k of resKeys) {
        const v = (res as any)[k];
        if (k === 'data') {
          resTyped[k] = {
            type: typeof v,
            isArr: Array.isArray(v),
            keys: v && typeof v === 'object' ? Object.keys(v).slice(0, 30) : undefined,
            preview: typeof v === 'string' ? v.slice(0, 500) : (v && typeof v === 'object' ? JSON.stringify(v).slice(0, 500) : String(v).slice(0, 200)),
          };
        } else if (k === 'header' || k === 'headers') {
          resTyped[k] = Object.prototype.toString.call(v) + (typeof v === 'object' ? JSON.stringify(v).slice(0, 500) : String(v).slice(0, 200));
        } else {
          resTyped[k] = typeof v === 'object' ? JSON.stringify(v).slice(0, 300) : String(v).slice(0, 200);
        }
      }
      dbgReport('D2', `[${name}] RES_STRUCT statusCode=${httpStatus} keys=${resKeys.join(',')}`, resTyped);
    } catch (e2: any) {
      dbgReport('D2', `[${name}] RES_STRUCT_DUMP_FAIL err=${e2?.message || e2}`);
    }

    if (httpStatus && (httpStatus < 200 || httpStatus >= 300)) {
      const rawBody = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      // #region debug-point H3-H4:callFunction-http-err
      dbgReport('D', `callFunction [${name}] HTTP ${httpStatus} url=${url} bodyLen=${rawBody?.length || 0}`, {
        httpStatus,
        body: rawBody?.slice(0, 800),
      });
      // #endregion
      // 常见 HTTP 错误提示
      let friendly = `请求失败 (HTTP ${httpStatus})`;
      if (httpStatus === 404) friendly = '接口不存在 (404)，请检查后端是否运行';
      if (httpStatus === 502 || httpStatus === 504) friendly = '后端服务不可达，请检查后端是否启动';
      throw new Error(friendly);
    }

    const result = res.data as ApiResponse<T>;
    if (!result || typeof result.code !== 'number') {
      // 响应不是预期的 {code, message, data} 结构
      const rawBody = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      // #region debug-point H3-H4:callFunction-bad-shape
      dbgReport('D', `callFunction [${name}] BAD_RESPONSE_SHAPE url=${url} httpStatus=${httpStatus}`, {
        body: rawBody?.slice(0, 800),
      });
      // #endregion
      throw new Error(`响应格式异常 (httpStatus=${httpStatus})`);
    }
    if (result.code !== 0) {
      // #region debug-point H3-H4:callFunction-code-non0
      dbgReport('D', `callFunction [${name}] method=${isGetMethod ? 'GET' : 'POST'} url=${url} code=${result.code} msg=${result.message || ''} statusCode=${httpStatus || 'n/a'}`, {
        code: result.code,
        message: result.message,
        data: result.data,
      });
      // #endregion
      throw new Error(result.message || '请求失败');
    }
    // #region debug-point H3-H4:callFunction-ok
    if (name === 'rooms' || name === 'auth/login' || name === 'auth/register' || name === 'auth/profile') {
      dbgReport('D', `callFunction [${name}] OK statusCode=${httpStatus || 'n/a'}`);
    }
    // #endregion
    return result.data;
  } catch (e) {
    // #region debug-point H3-H4:callFunction-network-err
    const msg = (e as any)?.message || String(e) || 'unknown error';
    const statusCode = (e as any)?.statusCode || (e as any)?.status || 'n/a';
    dbgReport('D', `callFunction [${name}] NETWORK/THROW status=${statusCode} err=${msg} url=${url}`, {
      errName: (e as any)?.name,
      errMessage: (e as any)?.message,
      errStack: (e as any)?.stack?.slice?.(0, 400),
      errData: (e as any)?.data,
    });
    // #endregion
    throw e;
  }
}

export { useRealApi };
