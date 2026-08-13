import { Router } from 'express';
import type { Server as IoServer } from 'socket.io';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export function createMessageRouter(io: IoServer) {
  const router = Router();

  // 序列化 room
  function serializeRoom(room: any) {
    const obj = typeof room.toJSON === 'function'
      ? room.toJSON()
      : (typeof room.toObject === 'function' ? room.toObject() : { ...room });
    if (obj._id) obj._id = String(obj._id);
    delete obj.__v;
    return obj;
  }

  function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // 获取消息列表（全部：邀请 + 系统 + 好友申请 + chat）
  router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const messages = await Message.find({ toOpenid: req.openid })
        .sort({ createTime: -1 })
        .limit(100)
        .lean();
      const list = messages.map(m => ({ ...m, _id: m._id.toString() }));
      return res.json({ code: 0, message: 'ok', data: list });
    } catch (err) {
      console.error('[Message] list error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 标记已读
  router.post('/read', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { messageIds } = req.body as { messageIds: string[] };
      await Message.updateMany(
        { _id: { $in: messageIds }, toOpenid: req.openid },
        { $set: { isRead: true } }
      );
      return res.json({ code: 0, message: 'ok', data: null });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 校验邀请中的房间是否还存在 + 返回房间信息
  // 用于用户点击消息中的邀请时，先检查房间是否存在
  router.get('/invite/check/:roomId', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);
      if (!room) {
        // 房间不存在：房主可能已经离开
        return res.json({ code: 0, message: 'ok', data: { exists: false, room: null } });
      }
      if (room.status === 'ended') {
        return res.json({ code: 0, message: 'ok', data: { exists: false, room: null } });
      }
      return res.json({
        code: 0, message: 'ok',
        data: { exists: true, room: serializeRoom(room) },
      });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 邀请好友（创建一条邀请消息）。data 里保存 roomId 和 roomCode。
  router.post('/invite', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { toOpenid, roomId, roomCode } = req.body;
      const fromUser = await User.findOne({ openid: req.openid }).lean();
      const msg = await Message.create({
        fromOpenid: req.openid,
        toOpenid,
        content: `${fromUser?.nickname || 'A friend'} invited you to join room ${roomCode}. Come play Draw Together!`,
        type: 'invite',
        data: JSON.stringify({
          roomId,
          roomCode,
          fromOpenid: req.openid,
          fromNickname: fromUser?.nickname || '',
          fromAvatar: fromUser?.avatar || '',
        }),
        isRead: false,
      });
      // socket 推送（让对方实时收到新消息提醒）
      io.emit(`message:new:${toOpenid}`, { ...msg.toJSON(), _id: (msg as any)._id.toString() });
      return res.json({ code: 0, message: '邀请已发送', data: msg.toJSON() });
    } catch (err) {
      console.error('[Message] invite error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  /**
   * 「邀请好友」快捷接口：
   * 1. 自动创建房间（默认1回合、默认6人上限）
   * 2. 把申请人以房主身份加入房间
   * 3. 给目标好友发送邀请消息
   * 返回 { roomId, roomCode, messageId }
   */
  router.post('/invite/create-and-send', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { toOpenid } = req.body as { toOpenid: string };
      if (!toOpenid) return res.json({ code: 1, message: '参数错误', data: null });

      const fromUser = await User.findOne({ openid: req.openid }).lean();
      if (!fromUser) return res.json({ code: 1, message: '用户不存在', data: null });

      // 生成房间号
      let roomCode = generateRoomCode();
      let exists = await Room.findOne({ roomCode });
      while (exists) {
        roomCode = generateRoomCode();
        exists = await Room.findOne({ roomCode });
      }

      // 默认 1 回合，最大 6 玩家，60 秒/轮
      const room = await Room.create({
        roomCode,
        name: `${fromUser.nickname}的房间`,
        owner: fromUser.openid,
        ownerNickname: fromUser.nickname,
        players: [{
          openid: fromUser.openid,
          nickname: fromUser.nickname,
          avatar: fromUser.avatar || '',
          score: 0,
          isReady: true,
          isOwner: true,
          status: 'online',
        }],
        maxPlayers: 6,
        totalRounds: 1,
        drawSeconds: 60,
        status: 'waiting',
      });

      const roomId = (room._id as any).toString();

      // 发送邀请消息
      const msg = await Message.create({
        fromOpenid: req.openid,
        toOpenid,
        content: `${fromUser.nickname} invited you to join room ${roomCode}. Come play Draw Together!`,
        type: 'invite',
        data: JSON.stringify({
          roomId,
          roomCode,
          fromOpenid: req.openid,
          fromNickname: fromUser.nickname,
          fromAvatar: fromUser.avatar || '',
        }),
        isRead: false,
      });

      // 实时通知
      io.emit(`message:new:${toOpenid}`, { ...msg.toJSON(), _id: (msg as any)._id.toString() });
      // 通知房间内（房主自己）刷新
      io.to(`room:${roomId}`).emit('room:updated', serializeRoom(room));

      return res.json({
        code: 0,
        message: '邀请已发送',
        data: {
          roomId,
          roomCode,
          messageId: (msg._id as any).toString(),
          room: serializeRoom(room),
        },
      });
    } catch (err) {
      console.error('[Message] invite/create-and-send error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  return router;
}

export default createMessageRouter;
