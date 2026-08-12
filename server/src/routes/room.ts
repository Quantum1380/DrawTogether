import { Router } from 'express';
import type { Server as IoServer } from 'socket.io';
import { Room } from '../models/Room';
import { User } from '../models/User';
import { GameRecord } from '../models/GameRecord';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { pickWord } from '../words';
import { broadcastAdmin } from '../socket';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * 安全地把 Mongoose 的 room 文档（或 lean 对象）序列化为给前端的 JSON。
 * 核心是确保 _id 一定是字符串，避免 toJSON / toObject 在不同调用方式下的不一致。
 */
function serializeRoom(room: any) {
  // 优先用自定义的 toJSON（model 里定义过的），否则用 toObject，都没有就直接当普通对象
  const obj = typeof room.toJSON === 'function'
    ? room.toJSON()
    : (typeof room.toObject === 'function' ? room.toObject() : { ...room });
  if (obj._id) obj._id = String(obj._id);
  delete obj.__v;
  return obj;
}

/**
 * 创建房间路由。
 * 注入 io 实例，用于在房间状态变化（准备/加入/离开/开始等）时向房间内广播，
 * 让其他在线玩家的房间页能实时刷新，而不必等待 5s 轮询。
 */
export function createRoomRouter(io: IoServer) {
  const router = Router();
  // 房间状态变化时广播给房间内所有人（发送方也会收到，前端用最新数据覆盖即可）
  const broadcastRoomUpdate = (roomId: string, room: any) => {
    const roomData = serializeRoom(room);
    io.to(`room:${roomId}`).emit('room:updated', roomData);
    // 房间状态变化也推送给所有管理员页面（房间列表页 / 数据总览）
    broadcastAdmin('admin:room-updated', roomData);
  };

  // 幂等保护：记录正在进行的回合切换（roomId → 开始切换时间戳）
  // 防止多端同时触发 /next-turn 导致 drawerIndex 被推进多次
  const transitioningRooms = new Map<string, number>();
  const TRANSITION_WINDOW_MS = 3000; // 3 秒内视为同一轮切换

  // 获取房间列表
  router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rooms = await Room.find({ status: { $ne: 'ended' } })
        .sort({ createTime: -1 })
        .limit(50);
      return res.json({ code: 0, message: 'ok', data: rooms.map(serializeRoom) });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 创建房间
  router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, maxPlayers = 6, totalRounds = 3, drawSeconds = 60 } = req.body;
      const user = await User.findOne({ openid: req.openid });
      if (!user) return res.json({ code: 1, message: '用户不存在', data: null });

      let roomCode = generateRoomCode();
      let exists = await Room.findOne({ roomCode });
      while (exists) {
        roomCode = generateRoomCode();
        exists = await Room.findOne({ roomCode });
      }

      const room = await Room.create({
        roomCode,
        name: name || `${user.nickname}的房间`,
        owner: user.openid,
        ownerNickname: user.nickname,
        players: [{
          openid: user.openid,
          nickname: user.nickname,
          avatar: user.avatar,
          score: 0,
          isReady: true,
          isOwner: true,
          status: 'online',
        }],
        maxPlayers,
        totalRounds,
        drawSeconds,
        status: 'waiting',
      });

      const roomData = serializeRoom(room);
      broadcastAdmin('admin:room-created', roomData);
      return res.json({ code: 0, message: '创建成功', data: roomData });
    } catch (err) {
      console.error('[Room] create error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 通过房间号加入
  router.post('/join', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomCode } = req.body;
      const room = await Room.findOne({ roomCode: roomCode?.toUpperCase() });
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });
      if (room.status === 'playing') return res.json({ code: 1, message: '游戏已开始', data: null });
      if (room.players.length >= room.maxPlayers) return res.json({ code: 1, message: '房间已满', data: null });

      const user = await User.findOne({ openid: req.openid });
      if (!user) return res.json({ code: 1, message: '用户不存在', data: null });

      const alreadyIn = room.players.find(p => p.openid === user.openid);
      if (!alreadyIn) {
        room.players.push({
          openid: user.openid,
          nickname: user.nickname,
          avatar: user.avatar,
          score: 0,
          isReady: false,
          isOwner: false,
          status: 'online',
        });
        await room.save();
      }

      // 通知房间内其他玩家刷新（新玩家加入）
      broadcastRoomUpdate(room._id.toString(), room);
      return res.json({ code: 0, message: '加入成功', data: serializeRoom(room) });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 获取房间详情
  router.get('/:roomId', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const room = await Room.findById(req.params.roomId);
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });
      return res.json({ code: 0, message: 'ok', data: serializeRoom(room) });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 离开房间
  router.post('/leave', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomId } = req.body;
      const room = await Room.findById(roomId);
      if (!room) return res.json({ code: 0, message: 'ok', data: null });

      room.players = room.players.filter(p => p.openid !== req.openid);

      if (room.players.length === 0) {
        await Room.deleteOne({ _id: roomId });
      } else {
        if (room.owner === req.openid) {
          const newOwner = room.players[0];
          newOwner.isOwner = true;
          room.owner = newOwner.openid;
          room.ownerNickname = newOwner.nickname;
        }
        await room.save();
        // 通知房间内剩余玩家刷新（有人离开 / 房主转移）
        broadcastRoomUpdate(roomId, room);
      }

      return res.json({ code: 0, message: '已离开', data: null });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 切换准备状态
  router.post('/ready', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomId } = req.body;
      const room = await Room.findById(roomId);
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });

      const player = room.players.find(p => p.openid === req.openid);
      if (!player) return res.json({ code: 1, message: '不在房间内', data: null });

      player.isReady = !player.isReady;
      await room.save();

      // 通知房间内所有人刷新准备状态
      broadcastRoomUpdate(roomId, room);
      return res.json({ code: 0, message: 'ok', data: serializeRoom(room) });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  /** 洗牌（Fisher-Yates），返回新数组 */
  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 开始游戏
  router.post('/start', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomId } = req.body;
      const room = await Room.findById(roomId);
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });
      if (room.owner !== req.openid) return res.json({ code: 1, message: '只有房主可以开始', data: null });
      if (room.players.length < 2) return res.json({ code: 1, message: '至少需要2名玩家', data: null });

      room.status = 'playing';
      room.currentRound = 1;
      // 第 1 大回合：随机玩家顺序作为画者顺序，保证「每个玩家画一次=一回合」
      room.drawerOrder = shuffle(room.players.map(p => p.openid));
      room.drawerIndex = 0;
      room.currentDrawer = room.drawerOrder[0];
      // 服务端统一选题并落库，确保房主与猜词玩家拿到的是同一个词；
      // 每次换画者都会重新随机新词，不会整局同一个词
      const firstWord = pickWord();
      room.currentWord = firstWord;
      room.usedWords = [firstWord];
      room.startedAt = new Date().toISOString();
      room.endedAt = '';
      await room.save();

      const data = serializeRoom(room);
      io.to(`room:${roomId}`).emit('game:started', data);

      return res.json({ code: 0, message: '游戏开始', data });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 进入下一位画者（或下一大回合/结束整局）
  // 触发条件：一位画者画完（全员猜对 or 时间到）
  router.post('/next-turn', authMiddleware, async (req: AuthRequest, res) => {
    const { roomId } = req.body;

    // 幂等保护：3 秒内同一房间只允许一次切换
    const now = Date.now();
    const lastTransition = transitioningRooms.get(roomId);
    if (lastTransition && now - lastTransition < TRANSITION_WINDOW_MS) {
      // 正在切换中，直接返回当前房间状态，不重复推进 drawerIndex
      try {
        const room = await Room.findById(roomId);
        if (room) {
          return res.json({ code: 0, message: '切换中', data: serializeRoom(room) });
        }
      } catch { /* ignore */ }
      return res.json({ code: 1, message: '房间不存在', data: null });
    }
    transitioningRooms.set(roomId, now);

    try {
      const room = await Room.findById(roomId);
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });
      if (room.status !== 'playing') return res.json({ code: 1, message: '游戏未开始', data: null });

      if (!room.drawerOrder?.length || typeof room.drawerIndex !== 'number') {
        // 老数据兜底：按当前玩家顺序初始化
        room.drawerOrder = shuffle(room.players.map(p => p.openid));
        room.drawerIndex = 0;
      }

      const nextDrawerIndex = room.drawerIndex + 1;

      if (nextDrawerIndex >= room.drawerOrder.length) {
        // 所有玩家都画过一次 → 本大回合结束
        const nextRound = room.currentRound + 1;
        if (nextRound > room.totalRounds) {
          // 整局游戏结束 - 归档到 GameRecord + 更新 User 统计
          room.status = 'ended';
          room.currentDrawer = '';
          room.currentWord = '';
          room.drawerIndex = room.drawerOrder.length;
          room.endedAt = new Date().toISOString();
          await room.save();

          // 计算胜者(分数最高者,平局取第一个)
          const ranked = [...room.players].sort((a, b) => b.score - a.score);
          const winner = ranked[0]
            ? { openid: ranked[0].openid, nickname: ranked[0].nickname }
            : null;

          // 写入对局记录(快照玩家信息)
          const gameRecordDoc = await GameRecord.create({
            roomId: room._id.toString(),
            roomCode: room.roomCode,
            roomName: room.name,
            players: room.players.map((p) => ({
              openid: p.openid,
              nickname: p.nickname,
              avatar: p.avatar,
              score: p.score,
            })),
            totalRounds: room.totalRounds,
            winner,
            words: room.usedWords || [],
            startTime: room.startedAt || room.createTime,
            endTime: room.endedAt,
          });

          // 批量更新玩家游戏统计
          for (const p of room.players) {
            const update: any = { $inc: { gamesPlayed: 1, totalScore: p.score } };
            if (winner && p.openid === winner.openid) {
              update.$inc.gamesWon = 1;
            }
            await User.updateOne({ openid: p.openid }, update);
          }

          // 通知管理后台：新对局记录已产生 + 数据统计变化
          const grPayload: any = gameRecordDoc.toJSON
            ? gameRecordDoc.toJSON()
            : (gameRecordDoc as any).toObject();
          grPayload._id = String(grPayload._id);
          delete grPayload.__v;
          broadcastAdmin('admin:game-ended', { record: grPayload });
          broadcastAdmin('admin:room-updated', serializeRoom(room));
          broadcastAdmin('admin:stats-changed', {});

          const data = serializeRoom(room);
          io.to(`room:${roomId}`).emit('game:ended', data);
          return res.json({ code: 0, message: '游戏结束', data });
        }

        // 进入下一个大回合：重新随机画者顺序（每大回合顺序都随机）
        room.currentRound = nextRound;
        room.drawerOrder = shuffle(room.players.map(p => p.openid));
        room.drawerIndex = 0;
      } else {
        // 本大回合内换下一位画者
        room.drawerIndex = nextDrawerIndex;
      }

      // 只要换了画者，就重新随机新词
      room.currentDrawer = room.drawerOrder[room.drawerIndex];
      const nextWord = pickWord();
      room.currentWord = nextWord;
      if (!room.usedWords) room.usedWords = [];
      room.usedWords.push(nextWord);
      await room.save();

      const data = serializeRoom(room);
      io.to(`room:${roomId}`).emit('game:next-turn', data);

      // 清理切换状态：3 秒后允许下一次切换
      setTimeout(() => transitioningRooms.delete(roomId), TRANSITION_WINDOW_MS);

      return res.json({ code: 0, message: 'ok', data });
    } catch (err) {
      // 出错也要清理，防止卡死
      transitioningRooms.delete(roomId);
      console.error('[Room] next-turn error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  // 踢出玩家
  router.post('/kick', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomId, openid } = req.body;
      const room = await Room.findById(roomId);
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });
      if (room.owner !== req.openid) return res.json({ code: 1, message: '只有房主可以踢人', data: null });

      room.players = room.players.filter(p => p.openid !== openid);

      if (room.players.length === 0) {
        // 踢出后房间空了,直接销毁(游戏已结束或只剩这一人)
        await Room.deleteOne({ _id: roomId });
        return res.json({ code: 0, message: '已踢出,房间已销毁', data: null });
      }

      await room.save();
      broadcastRoomUpdate(roomId, room);
      return res.json({ code: 0, message: '已踢出', data: serializeRoom(room) });
    } catch (err) {
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  /**
   * 房主修改房间设置：
   * - 允许修改：name、maxPlayers、totalRounds、drawSeconds
   * - 仅 waiting 状态下允许修改；游戏开始后禁止修改回合/秒数等基础配置
   * - maxPlayers：不能小于当前房间人数
   * - totalRounds：1~20 之间
   * - drawSeconds：30~180 之间
   */
  router.post('/settings', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { roomId, name, maxPlayers, totalRounds, drawSeconds } = req.body as {
        roomId: string;
        name?: string;
        maxPlayers?: number;
        totalRounds?: number;
        drawSeconds?: number;
      };
      if (!roomId) return res.json({ code: 1, message: '参数错误', data: null });

      const room = await Room.findById(roomId);
      if (!room) return res.json({ code: 1, message: '房间不存在', data: null });
      if (room.owner !== req.openid) return res.json({ code: 1, message: '只有房主可以修改设置', data: null });
      if (room.status !== 'waiting') return res.json({ code: 1, message: '游戏已开始，无法修改', data: null });

      if (typeof name === 'string' && name.trim().length > 0) {
        room.name = name.trim().slice(0, 24);
      }
      if (typeof maxPlayers === 'number') {
        const clamped = Math.min(10, Math.max(2, Math.floor(maxPlayers)));
        if (clamped < room.players.length) {
          return res.json({ code: 1, message: `人数不能少于当前房间人数(${room.players.length})`, data: null });
        }
        room.maxPlayers = clamped;
      }
      if (typeof totalRounds === 'number') {
        const clamped = Math.min(20, Math.max(1, Math.floor(totalRounds)));
        room.totalRounds = clamped;
      }
      if (typeof drawSeconds === 'number') {
        const clamped = Math.min(180, Math.max(30, Math.floor(drawSeconds)));
        room.drawSeconds = clamped;
      }

      await room.save();
      broadcastRoomUpdate(roomId, room);
      return res.json({ code: 0, message: '设置已保存', data: serializeRoom(room) });
    } catch (err) {
      console.error('[Room] settings error:', err);
      return res.json({ code: 1, message: '服务器错误', data: null });
    }
  });

  return router;
}
