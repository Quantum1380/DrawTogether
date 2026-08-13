import { Router } from 'express';
import { Room } from '../models/Room';
import { User } from '../models/User';

/**
 * 开发测试 / 运维辅助 路由
 * - 清理已结束房间、用户在线状态查询、活跃房间统计
 */
export function createDevRouter() {
  const router = Router();
  // 用法: POST /api/dev/cleanup-rooms
  router.post('/cleanup-rooms', async (_req, res) => {
    try {
      const result = await Room.deleteMany({ status: 'ended' });
      const deleted = result.deletedCount || 0;
      return res.json({
        code: 0,
        message: deleted > 0 ? `已清理 ${deleted} 个已结束房间` : '没有需要清理的房间',
        data: { deleted },
      });
    } catch (err) {
      console.error('[Dev] cleanup-rooms error:', err);
      return res.json({ code: 1, message: '清理失败', data: null });
    }
  });

  // 查看当前房间统计(方便排查)
  router.get('/rooms-stats', async (_req, res) => {
    try {
      const [waiting, playing, ended, total] = await Promise.all([
        Room.countDocuments({ status: 'waiting' }),
        Room.countDocuments({ status: 'playing' }),
        Room.countDocuments({ status: 'ended' }),
        Room.countDocuments({}),
      ]);
      return res.json({
        code: 0,
        message: 'ok',
        data: { waiting, playing, ended, total },
      });
    } catch (err) {
      return res.json({ code: 1, message: '查询失败', data: null });
    }
  });

  // 查看所有用户的在线状态(排查用)
  router.get('/users-status', async (_req, res) => {
    try {
      const users = await User.find({}, 'phone nickname status').lean();
      return res.json({
        code: 0,
        message: 'ok',
        data: users.map((u) => ({ phone: u.phone, nickname: u.nickname, status: u.status })),
      });
    } catch (err) {
      return res.json({ code: 1, message: '查询失败', data: null });
    }
  });

  return router;
}
