import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AdminRequest extends Request {
  adminId?: string;
  adminRole?: 'super' | 'admin';
}

/** 生成管理员 token(使用独立的 adminJwtSecret,与用户 token 隔离) */
export function generateAdminToken(adminId: string, role: 'super' | 'admin'): string {
  return jwt.sign({ adminId, role, scope: 'admin' }, config.adminJwtSecret, {
    expiresIn: config.adminJwtExpires as any,
  } as any);
}

/** 管理员鉴权中间件 */
export function adminAuthMiddleware(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ code: 401, message: '未登录', data: null });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.adminJwtSecret) as {
      adminId: string;
      role: 'super' | 'admin';
      scope?: string;
    };
    // 防止用户 token 误用(admin token 必须带 scope=admin)
    if (decoded.scope !== 'admin') {
      return res.json({ code: 401, message: 'Token 类型错误', data: null });
    }
    req.adminId = decoded.adminId;
    req.adminRole = decoded.role;
    next();
  } catch {
    return res.json({ code: 401, message: 'Token 已过期', data: null });
  }
}
