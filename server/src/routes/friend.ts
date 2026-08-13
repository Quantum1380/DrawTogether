import { Router } from 'express';
import { Friend } from '../models/Friend';
import { User } from '../models/User';
import { UserContact } from '../models/UserContact';
import { FriendRequest } from '../models/FriendRequest';
import { Message } from '../models/Message';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isUserOnline } from '../socket';

const router = Router();

// 获取好友列表
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const friendRecords = await Friend.find({ openid: req.openid });
    const friendOpenids = friendRecords.map(f => f.friendOpenid);
    const users = await User.find({ openid: { $in: friendOpenids } }).lean();

    // 用内存中的实时 socket 引用计数覆盖 status 字段
    const friends = users.map(u => ({
      ...u,
      _id: u._id.toString(),
      status: isUserOnline(u.openid) ? 'online' : 'offline',
      source: 'contacts',  // 简单处理，搜索页会判断
    }));

    return res.json({ code: 0, message: 'ok', data: friends });
  } catch (err) {
    console.error('[Friends] list error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 获取在线状态
router.post('/online-status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { openids } = req.body as { openids: string[] };
    const statusMap: Record<string, string> = {};
    openids.forEach(openid => {
      statusMap[openid] = isUserOnline(openid) ? 'online' : 'offline';
    });
    return res.json({ code: 0, message: 'ok', data: statusMap });
  } catch (err) {
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 同步通讯录 - 检查哪些手机号已注册
router.post('/sync-contacts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { contacts } = req.body as { contacts: { name: string; phone: string }[] };
    const phones = contacts.map(c => c.phone).filter(Boolean);
    const registeredUsers = await User.find({ phone: { $in: phones } }).lean();

    // 已注册用户 openid 判断是否是好友
    const friendRecords = await Friend.find({ openid: req.openid }).lean();
    const friendSet = new Set(friendRecords.map(f => f.friendOpenid));

    // 已申请状态查询（pending 申请）
    const requested = await FriendRequest.find({
      fromOpenid: req.openid,
      status: 'pending'
    }).lean();
    const requestedSet = new Set(requested.map(r => r.toOpenid));

    const result = contacts.map(c => {
      const user = registeredUsers.find(u => u.phone === c.phone);
      const online = user ? isUserOnline(user.openid) : false;
      return {
        name: c.name,
        phone: c.phone,
        registered: !!user,
        avatar: user?.avatar || '',
        openid: user?.openid || '',
        // 已注册时：返回是否已是好友、是否已发送 pending 申请
        status: user ? (
          friendSet.has(user.openid) ? 'friend'
            : requestedSet.has(user.openid) ? 'requested'
            : 'not_friend'
        ) : 'not_registered',
        // 实时在线状态（基于内存引用计数），供前端在「已是好友」场景下显示「邀请」或「未上线」
        isOnline: online,
      };
    });

    // 同步通讯录快照到数据库
    const contactsSnapshot = result.map(c => ({
      name: c.name,
      phone: c.phone,
      registered: c.registered,
      registeredOpenid: c.openid || '',
      registeredAvatar: c.avatar || '',
    }));
    const registeredCount = contactsSnapshot.filter(c => c.registered).length;
    await UserContact.findOneAndUpdate(
      { openid: req.openid },
      {
        $set: {
          contacts: contactsSnapshot,
          total: contactsSnapshot.length,
          registeredCount,
          syncTime: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    return res.json({ code: 0, message: 'ok', data: result });
  } catch (err) {
    console.error('[Friends] syncContacts error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 搜索用户 - 支持按用户名、昵称、手机号搜索
// 返回结果附带：isFriend（是否已是好友）、hasRequested（是否已发送pending申请）
// 未注册的用户不在搜索结果里（搜索仅针对已注册用户）
router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { keyword } = req.query as { keyword: string };
    if (!keyword || keyword.trim().length === 0) {
      return res.json({ code: 0, message: 'ok', data: [] });
    }
    const kw = keyword.trim();
    // 转义正则特殊字符，防止用户输入的 . * + ? 等被当作正则元字符
    const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 用户名/昵称/手机号：大小写不敏感的包含匹配
    const kwRegex = new RegExp(escapedKw, 'i');
    // UID（openid）：大小写不敏感的前缀匹配，支持「输入部分 UID 命中」
    // 例如输入 "9E4" 能命中 "9E4YAY"；输入小写 "9e4yay" 也能命中 "9E4YAY"
    const uidRegex = new RegExp('^' + escapedKw, 'i');

    const users = await User.find({
      $and: [
        { openid: { $ne: req.openid } },
        {
          $or: [
            { openid: { $regex: uidRegex } },
            { username: { $regex: kwRegex } },
            { nickname: { $regex: kwRegex } },
            { phone: { $regex: kwRegex } },
          ],
        },
      ],
    }).select('openid username nickname avatar phone status').limit(20).lean();

    // 当前用户的好友关系
    const friendRecords = await Friend.find({ openid: req.openid }).select('friendOpenid').lean();
    const friendSet = new Set(friendRecords.map(f => f.friendOpenid));

    // 当前用户已发送的 pending 申请
    const requests = await FriendRequest.find({
      fromOpenid: req.openid,
      status: 'pending'
    }).select('toOpenid').lean();
    const requestSet = new Set(requests.map(r => r.toOpenid));

    const results = users.map(u => ({
      openid: u.openid,
      username: u.username,
      nickname: u.nickname,
      avatar: u.avatar || '',
      phone: u.phone || '',
      status: isUserOnline(u.openid) ? 'online' : 'offline',
      isFriend: friendSet.has(u.openid),
      hasRequested: requestSet.has(u.openid),
    }));

    return res.json({ code: 0, message: 'ok', data: results });
  } catch (err) {
    console.error('[Friends] search error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 发送好友申请
router.post('/request', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { toOpenid, message = '' } = req.body as { toOpenid: string; message?: string };
    if (!toOpenid) return res.json({ code: 1, message: '参数错误', data: null });
    if (toOpenid === req.openid) return res.json({ code: 1, message: '不能添加自己', data: null });

    const target = await User.findOne({ openid: toOpenid }).lean();
    if (!target) return res.json({ code: 1, message: '用户不存在', data: null });

    // 是否已是好友
    const existingFriend = await Friend.findOne({ openid: req.openid, friendOpenid: toOpenid });
    if (existingFriend) return res.json({ code: 1, message: '已经是好友了', data: null });

    // 是否已有 pending 申请（避免重复发送）
    const existingRequest = await FriendRequest.findOne({
      fromOpenid: req.openid,
      toOpenid,
      status: 'pending'
    });
    if (existingRequest) return res.json({ code: 1, message: '已发送过申请，等待对方处理', data: null });

    const fromUser = await User.findOne({ openid: req.openid }).lean();

    // 创建申请记录（用 try-catch 避开索引冲突）
    let request: any = null;
    try {
      request = await FriendRequest.create({
        fromOpenid: req.openid,
        toOpenid,
        status: 'pending',
        message,
      });
    } catch (e) {
      return res.json({ code: 1, message: '已发送过申请，等待对方处理', data: null });
    }

    // 给目标用户发一条 friend_request 类型消息
    await Message.create({
      fromOpenid: req.openid,
      toOpenid,
      content: `${fromUser?.nickname || 'Someone'} wants to add you as a friend${message ? ': ' + message : ''}`,
      type: 'friend_request',
      data: JSON.stringify({
        requestId: request._id.toString(),
        fromOpenid: req.openid,
        fromNickname: fromUser?.nickname || '',
        fromAvatar: fromUser?.avatar || '',
        message,
      }),
      isRead: false,
    });

    return res.json({ code: 0, message: '申请已发送', data: { requestId: request._id.toString() } });
  } catch (err) {
    console.error('[Friends] request error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 我收到的好友申请列表（pending 状态）
router.get('/requests/incoming', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const requests = await FriendRequest.find({
      toOpenid: req.openid,
      status: 'pending'
    }).sort({ createTime: -1 }).lean();

    const fromOpenids = requests.map(r => r.fromOpenid);
    const users = await User.find({ openid: { $in: fromOpenids } }).lean();
    const userMap = new Map(users.map(u => [u.openid, u]));

    const data = requests.map(r => {
      const u = userMap.get(r.fromOpenid);
      return {
        _id: r._id.toString(),
        requestId: r._id.toString(),
        fromOpenid: r.fromOpenid,
        fromNickname: u?.nickname || '',
        fromAvatar: u?.avatar || '',
        fromUsername: u?.username || '',
        message: r.message || '',
        createTime: r.createTime,
        status: r.status,
      };
    });

    return res.json({ code: 0, message: 'ok', data });
  } catch (err) {
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 同意好友申请
router.post('/requests/:requestId/accept', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findOne({ _id: requestId, toOpenid: req.openid, status: 'pending' });
    if (!request) return res.json({ code: 1, message: '申请不存在或已处理', data: null });

    // 设置已处理
    request.status = 'accepted';
    (request as any).handledAt = new Date().toISOString();
    await request.save();

    // 双向添加好友关系
    await Friend.bulkWrite([
      { insertOne: { document: { openid: req.openid, friendOpenid: request.fromOpenid, source: 'request' } } },
      { insertOne: { document: { openid: request.fromOpenid, friendOpenid: req.openid, source: 'request' } } },
    ]).catch(() => { /* 已存在则忽略 */ });

    // 给对方发一条系统消息告知已通过
    await Message.create({
      fromOpenid: req.openid,
      toOpenid: request.fromOpenid,
      content: 'accepted your friend request',
      type: 'system',
      data: '',
      isRead: false,
    });

    return res.json({ code: 0, message: '已同意', data: null });
  } catch (err) {
    console.error('[Friends] accept error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 拒绝好友申请
router.post('/requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.params;
    const request = await FriendRequest.findOne({ _id: requestId, toOpenid: req.openid, status: 'pending' });
    if (!request) return res.json({ code: 1, message: '申请不存在或已处理', data: null });

    request.status = 'rejected';
    (request as any).handledAt = new Date().toISOString();
    await request.save();

    return res.json({ code: 0, message: '已拒绝', data: null });
  } catch (err) {
    console.error('[Friends] reject error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 添加好友（直接添加，用在通讯录同步的“申请”也复用同一接口 /request，这里保留旧功能）
router.post('/add', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { openid: friendOpenid } = req.body;
    if (friendOpenid === req.openid) {
      return res.json({ code: 1, message: '不能添加自己', data: null });
    }

    const friendUser = await User.findOne({ openid: friendOpenid });
    if (!friendUser) return res.json({ code: 1, message: '用户不存在', data: null });

    const existing = await Friend.findOne({ openid: req.openid, friendOpenid });
    if (existing) return res.json({ code: 1, message: '已经是好友了', data: null });

    await Friend.create({ openid: req.openid, friendOpenid, source: 'manual' });
    await Friend.create({ openid: friendOpenid, friendOpenid: req.openid, source: 'manual' });

    return res.json({ code: 0, message: '添加成功', data: null });
  } catch (err) {
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

export default router;
