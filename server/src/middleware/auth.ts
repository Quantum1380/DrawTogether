import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
  openid?: string;
}

export function generateToken(userId: string, openid: string): string {
  return jwt.sign({ userId, openid }, config.jwtSecret, { expiresIn: config.jwtExpires as any } as any);
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录', data: null });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; openid: string };
    req.userId = decoded.userId;
    req.openid = decoded.openid;

    // 实时检查封禁状态(每次请求查 DB,确保封禁立即生效)
    const user = await User.findOne({ openid: decoded.openid }).select('banStatus');
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户不存在', data: null });
    }
    if (user.banStatus?.banned) {
      return res.status(403).json({
        code: 403,
        message: `账号已被封禁: ${user.banStatus.banReason || '违规行为'}`,
        data: null,
      });
    }
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token 已过期', data: null });
  }
}
