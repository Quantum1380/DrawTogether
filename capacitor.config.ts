import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 配置
 * - webDir: Taro build:h5 输出的 H5 资源目录（config/index.ts 里 outputRoot 默认 'dist'）
 * - appId: Android 包名，发布到应用商店时不可更改，请慎重
 * - androidScheme: https → APK 内 WebView 用 https://localhost 加载，避免 file:// 的 CORS 问题
 * - allowNavigation: 允许 WebView 内跳转到 ngrok 域名（实际接口由 fetch/socket.io 直连公网）
 */
const config: CapacitorConfig = {
  appId: 'com.drawtogether.app',
  appName: '你画我猜',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // 允许的导航主机（cpolar 域名经常变，CapacitorHttp 模式下 API 请求不走 WebView，留空即可）
    allowNavigation: [],
  },
  android: {
    // 允许混合内容（如果后端临时用了 http 资源）
    allowMixedContent: true,
    // WebView 调试开关：正式发布前改为 false
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    // 启用原生 HTTP：在 Android 上通过 OkHttp 原生层发请求，
    // 完全绕过 WebView 的 CORS 预检机制。
    // 背景：Android WebView (Chrome 114) 存在已知 bug ——
    //   POST 请求在 OPTIONS 预检通过后能正常发出，
    //   但 GET 请求在预检通过后不会发出实际请求，导致创建房间后
    //   拉取房间详情（GET /api/rooms/:id）永远只拿到 204 预检响应。
    // 启用后，fetch/XHR 在原生平台走原生 HTTP，CORS 不再适用；
    // 浏览器开发环境（H5 dev）不受影响，仍走标准 fetch。
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
