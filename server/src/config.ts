import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/draw_together',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  // 管理员 token 独立 secret,避免与 socket 鉴权(取 decoded.openid)冲突
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || 'admin_fallback_secret',
  adminJwtExpires: process.env.ADMIN_JWT_EXPIRES || '2h',
  // 支持多个 origin，用逗号分隔
  // 10086/10087 玩家端, 10088 管理后台, https://localhost Capacitor APK, cpolar 公网域名
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:10086,http://localhost:10087,http://localhost:10088,https://localhost')
    .split(',')
    .map((s) => s.trim()),
};

/**
 * 判断 origin 是否在 CORS 白名单中（精确匹配，不用正则通配，更安全）。
 * cpolar 域名变了就手动改 .env 的 CLIENT_ORIGIN。
 * @param origin 请求头中的 Origin，可能为 undefined（如服务端内部请求、curl）
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  // 无 Origin 的请求（如内部服务、curl）直接放行
  if (!origin) return true;
  // 精确匹配白名单
  return config.clientOrigin.includes(origin);
}

