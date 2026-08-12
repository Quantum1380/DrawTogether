import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { GameRecord } from '../models/GameRecord';
import { AdminActionLog } from '../models/AdminActionLog';
import { UserContact } from '../models/UserContact';
import { Friend } from '../models/Friend';
import { isUserOnline, getOnlineUserCount, broadcastAdmin } from '../socket';
import { adminAuthMiddleware, generateAdminToken, AdminRequest } from '../middleware/adminAuth';

/**
 * 管理后台路由
 * - 鉴权使用独立的 adminJwtSecret,与玩家 token 隔离
 * - 响应格式统一 { code: 0|1, message, data }
 */
export function createAdminRouter(_io?: any): Router {
  const router = Router();

  // ============================================
  // 登录 / 当前管理员
  // ============================================

  // 管理员登录
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.json({ code: 1, message: '用户名和密码不能为空', data: null });
      }
      const admin = await Admin.findOne({ username });
      if (!admin) {
        return res.json({ code: 1, message: '管理员不存在', data: null });
      }
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.json({ code: 1, message: '密码错误', data: null });
      }
      admin.lastLoginAt = new Date().toISOString();
      await admin.save();
      const token = generateAdminToken(admin._id.toString(), admin.role);
      const adminData = admin.toJSON();
      // 写审计日志
      await AdminActionLog.create({
        adminId: admin._id.toString(),
        adminName: admin.username,
        action: 'login',
        targetType: 'admin',
        targetId: admin._id.toString(),
        targetName: admin.username,
        detail: '管理员登录',
        time: new Date().toISOString(),
      });
      return res.json({ code: 0, message: '登录成功', data: { token, admin: adminData } });
    } catch (err) {
      console.error('[Admin] login error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 获取当前管理员信息
  router.get('/profile', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const admin = await Admin.findById(req.adminId);
      if (!admin) {
        return res.json({ code: 1, message: '管理员不存在', data: null });
      }
      return res.json({ code: 0, message: 'ok', data: admin.toJSON() });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 退出登录(无状态,前端清 localStorage 即可)
  router.post('/logout', adminAuthMiddleware, async (req: AdminRequest, res: Response) => {
    try {
      const admin = await Admin.findById(req.adminId);
      if (admin) {
        await AdminActionLog.create({
          adminId: admin._id.toString(),
          adminName: admin.username,
          action: 'logout',
          targetType: 'admin',
          targetId: admin._id.toString(),
          targetName: admin.username,
          detail: '管理员退出',
          time: new Date().toISOString(),
        });
      }
      return res.json({ code: 0, message: '已退出', data: null });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // ============================================
  // 数据统计
  // ============================================

  router.get('/stats', adminAuthMiddleware, async (_req: AdminRequest, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [totalPlayers, todayNewPlayers, totalGames, todayGames, totalBanned] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ createTime: { $gte: todayStart } }),
          GameRecord.countDocuments(),
          GameRecord.countDocuments({ endTime: { $gte: todayStart } }),
          User.countDocuments({ 'banStatus.banned': true }),
        ]);
      // 在线人数用实时 socket 数据，不依赖 User.status
      const onlinePlayers = getOnlineUserCount();

      return res.json({
        code: 0,
        message: 'ok',
        data: { totalPlayers, onlinePlayers, todayNewPlayers, totalGames, todayGames, totalBanned },
      });
    } catch (err) {
      console.error('[Admin] stats error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // ============================================
  // 玩家管理
  // ============================================

  // 玩家列表(分页 + 搜索)
  router.get('/players', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
      const keyword = (req.query.keyword as string) || '';
      const status = (req.query.status as string) || '';

      const query: any = {};
      if (keyword) {
        query.$or = [
          { username: new RegExp(keyword, 'i') },
          { nickname: new RegExp(keyword, 'i') },
        ];
      }
      if (status === 'banned') query['banStatus.banned'] = true;

      const skip = (page - 1) * pageSize;
      const [list, total] = await Promise.all([
        User.find(query).sort({ createTime: -1 }).skip(skip).limit(pageSize).lean(),
        User.countDocuments(query),
      ]);

      // 用实时 socket 状态覆盖 User.status
      let resultList = list.map((u: any) => {
        const online = isUserOnline(u.openid);
        return {
          ...u,
          _id: u._id.toString(),
          status: online ? 'online' : 'offline',
          password: undefined,
          __v: undefined,
        };
      });

      // 如果按在线/离线过滤，在内存中过滤（因为 User.status 不准确）
      if (status === 'online') resultList = resultList.filter((u: any) => u.status === 'online');
      else if (status === 'offline') resultList = resultList.filter((u: any) => u.status === 'offline');

      return res.json({
        code: 0,
        message: 'ok',
        data: { list: resultList, total, page, pageSize },
      });
    } catch (err) {
      console.error('[Admin] players list error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 玩家详情
  router.get('/players/:id', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const user = await User.findById(req.params.id).lean();
      if (!user) {
        return res.json({ code: 1, message: '玩家不存在', data: null });
      }
      // 用实时 socket 状态覆盖
      const online = isUserOnline(user.openid);
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          ...user,
          _id: user._id.toString(),
          status: online ? 'online' : 'offline',
          password: undefined,
          __v: undefined,
        },
      });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 玩家通讯录 - 查看该用户同步过的通讯录联系人
  // - registered=true 只返回已注册的联系人
  // - 未同步过通讯录时返回 null
  router.get('/players/:id/contacts', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const user = await User.findById(req.params.id).lean();
      if (!user) {
        return res.json({ code: 1, message: '玩家不存在', data: null });
      }
      const filterRegistered = req.query.registered === 'true';
      const record = await UserContact.findOne({ openid: user.openid }).lean();
      if (!record) {
        return res.json({
          code: 0,
          message: 'ok',
          data: { synced: false, contacts: [], total: 0, registeredCount: 0, syncTime: '' },
        });
      }
      const contacts = filterRegistered
        ? record.contacts.filter(c => c.registered)
        : record.contacts;
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          synced: true,
          contacts,
          total: record.total,
          registeredCount: record.registeredCount,
          syncTime: record.syncTime,
        },
      });
    } catch (err) {
      console.error('[Admin] contacts error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 玩家好友列表 - 查看该用户添加的所有好友
  // - 双向好友关系存储在 Friend 集合中（每对好友有两条记录）
  // - 这里查询用户作为一方添加的好友，并 join 出好友的用户信息
  router.get('/players/:id/friends', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const user = await User.findById(req.params.id).lean();
      if (!user) {
        return res.json({ code: 1, message: '玩家不存在', data: null });
      }
      const friendRecords = await Friend.find({ openid: user.openid }).lean();
      const friendOpenids = friendRecords.map(f => f.friendOpenid);
      const friendUsers = await User.find({ openid: { $in: friendOpenids } }).lean();
      // 以添加时间排序（最近添加在前）
      const friendMap = new Map(friendUsers.map(u => [u.openid, u]));
      const friends = friendRecords
        .map(f => {
          const fu = friendMap.get(f.friendOpenid);
          if (!fu) return null;
          return {
            _id: fu._id.toString(),
            openid: fu.openid,
            username: fu.username,
            nickname: fu.nickname,
            avatar: fu.avatar || '',
            phone: fu.phone || '',
            status: isUserOnline(fu.openid) ? 'online' : 'offline',
            gamesPlayed: fu.gamesPlayed,
            gamesWon: fu.gamesWon,
            totalScore: fu.totalScore,
            banStatus: fu.banStatus,
            createTime: fu.createTime,
            addedAt: f.createTime,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (a.addedAt < b.addedAt ? 1 : -1));

      // 在线人数统计
      const onlineCount = friends.filter((f: any) => f.status === 'online').length;

      return res.json({
        code: 0,
        message: 'ok',
        data: {
          total: friends.length,
          onlineCount,
          friends,
        },
      });
    } catch (err) {
      console.error('[Admin] friends error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 封禁玩家
  router.post('/players/:id/ban', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.json({ code: 1, message: '请填写封禁原因', data: null });
      }
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.json({ code: 1, message: '玩家不存在', data: null });
      }
      user.banStatus = {
        banned: true,
        banReason: reason.trim(),
        bannedAt: new Date().toISOString(),
        bannedBy: req.adminId || '',
      };
      await user.save();

      const admin = await Admin.findById(req.adminId);
      await AdminActionLog.create({
        adminId: req.adminId || '',
        adminName: admin?.username || '',
        action: 'ban',
        targetType: 'player',
        targetId: user._id.toString(),
        targetName: user.username,
        detail: `封禁原因: ${reason.trim()}`,
        time: new Date().toISOString(),
      });

      // 通知管理后台：玩家封禁状态已变化（所有管理员页面实时刷新）
      const userPayload: any = user.toJSON ? user.toJSON() : user.toObject();
      userPayload._id = String(userPayload._id);
      userPayload.status = isUserOnline(user.openid) ? 'online' : 'offline';
      delete userPayload.password;
      delete userPayload.__v;
      broadcastAdmin('admin:player-banned', { player: userPayload });
      broadcastAdmin('admin:stats-changed', {});

      return res.json({ code: 0, message: '已封禁', data: user.toJSON() });
    } catch (err) {
      console.error('[Admin] ban error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 解封玩家
  router.post('/players/:id/unban', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.json({ code: 1, message: '玩家不存在', data: null });
      }
      user.banStatus = { banned: false, banReason: '', bannedAt: '', bannedBy: '' };
      await user.save();

      const admin = await Admin.findById(req.adminId);
      await AdminActionLog.create({
        adminId: req.adminId || '',
        adminName: admin?.username || '',
        action: 'unban',
        targetType: 'player',
        targetId: user._id.toString(),
        targetName: user.username,
        detail: '解除封禁',
        time: new Date().toISOString(),
      });

      // 通知管理后台：玩家封禁状态已变化
      const userPayload: any = user.toJSON ? user.toJSON() : user.toObject();
      userPayload._id = String(userPayload._id);
      userPayload.status = isUserOnline(user.openid) ? 'online' : 'offline';
      delete userPayload.password;
      delete userPayload.__v;
      broadcastAdmin('admin:player-unbanned', { player: userPayload });
      broadcastAdmin('admin:stats-changed', {});

      return res.json({ code: 0, message: '已解封', data: user.toJSON() });
    } catch (err) {
      console.error('[Admin] unban error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // ============================================
  // 对局记录
  // ============================================

  // 对局列表(分页 + 搜索)
  router.get('/games', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
      const keyword = (req.query.keyword as string) || '';
      const dateFrom = (req.query.dateFrom as string) || '';
      const dateTo = (req.query.dateTo as string) || '';

      const query: any = {};
      if (keyword) {
        query.$or = [
          { roomCode: new RegExp(keyword, 'i') },
          { roomName: new RegExp(keyword, 'i') },
        ];
      }
      if (dateFrom || dateTo) {
        query.endTime = {};
        if (dateFrom) query.endTime.$gte = new Date(dateFrom).toISOString();
        if (dateTo) query.endTime.$lte = new Date(dateTo + 'T23:59:59.999Z').toISOString();
      }

      const skip = (page - 1) * pageSize;
      const [list, total] = await Promise.all([
        GameRecord.find(query).sort({ endTime: -1 }).skip(skip).limit(pageSize),
        GameRecord.countDocuments(query),
      ]);

      return res.json({
        code: 0,
        message: 'ok',
        data: { list, total, page, pageSize },
      });
    } catch (err) {
      console.error('[Admin] games list error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 对局详情
  router.get('/games/:id', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const record = await GameRecord.findById(req.params.id);
      if (!record) {
        return res.json({ code: 1, message: '对局记录不存在', data: null });
      }
      return res.json({ code: 0, message: 'ok', data: record });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // ============================================
  // 房间列表(辅助查看活跃房间)
  // ============================================

  router.get('/rooms', adminAuthMiddleware, async (req: AdminRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
      const status = (req.query.status as string) || '';

      const query: any = {};
      if (status) query.status = status;

      const skip = (page - 1) * pageSize;
      const [list, total] = await Promise.all([
        Room.find(query).sort({ createTime: -1 }).skip(skip).limit(pageSize),
        Room.countDocuments(query),
      ]);

      return res.json({
        code: 0,
        message: 'ok',
        data: { list: list.map((r) => r.toJSON()), total, page, pageSize },
      });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  return router;
}
