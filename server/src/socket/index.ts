import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config, isOriginAllowed } from '../config';
import { Room } from '../models/Room';
import { User } from '../models/User';

// ============================================================
// 管理后台实时推送（admin 专用通道）
// - 玩家端连接使用用户 token（decoded.openid）
// - 管理后台连接使用管理员 token（decoded.adminId + scope=admin）
// - 所有 admin 连接自动加入房间 `admin:global`，
//   业务层只需调用 broadcastAdmin('xxx', payload) 即可通知所有管理员。
// ============================================================

const ADMIN_ROOM = 'admin:global';
let ioRef: SocketServer | null = null;

/**
 * 在线用户引用计数: openid -> 活动 socket 数量
 * 支持同一账号多端登录,只有所有 socket 都断开才视为下线
 */
const onlineSocketsCount = new Map<string, number>();

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  points: DrawPoint[];
  color: string;
  width: number;
}

export function setupSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      // 统一使用 isOriginAllowed 判断（支持精确匹配 + ngrok/cpolar 通配域名）
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} 不在 CORS 白名单中`));
      },
      methods: ['GET', 'POST'],
    },
  });

  // 鉴权中间件：支持玩家 token / 管理员 token（双 secret）
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) {
      return next(new Error('未登录'));
    }

    // 1) 先尝试玩家 token
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; openid: string };
      (socket as any).openid = decoded.openid;
      (socket as any).clientType = 'player';
      return next();
    } catch (_playerErr) {
      // 继续尝试管理员 token
    }

    // 2) 尝试管理员 token
    try {
      const decoded = jwt.verify(token, config.adminJwtSecret) as {
        adminId: string;
        role: 'super' | 'admin';
        scope?: string;
      };
      if (decoded.scope !== 'admin') {
        return next(new Error('Token 类型错误'));
      }
      (socket as any).adminId = decoded.adminId;
      (socket as any).adminRole = decoded.role;
      (socket as any).clientType = 'admin';
      return next();
    } catch (_adminErr) {
      return next(new Error('Token 无效'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const clientType = (socket as any).clientType as 'player' | 'admin';

    // ---- 管理员连接：加入 admin 全局房间，不走玩家在线计数 / 房间逻辑 ----
    if (clientType === 'admin') {
      const adminId = (socket as any).adminId as string;
      const adminRole = (socket as any).adminRole as string;
      console.log(`[Socket] 管理员连接: ${adminId} (${adminRole})`);
      socket.join(ADMIN_ROOM);
      socket.emit('admin:connected', { ok: true, adminId, role: adminRole });

      socket.on('disconnect', () => {
        console.log(`[Socket] 管理员断开: ${adminId}`);
      });
      return; // 管理员不走下面的玩家逻辑
    }

    // ---- 玩家连接 ----
    const openid = (socket as any).openid as string;
    console.log(`[Socket] 用户连接: ${openid}`);

    // 引用计数 +1,首个连接时把 status 置 online
    const prevCount = onlineSocketsCount.get(openid) || 0;
    onlineSocketsCount.set(openid, prevCount + 1);
    if (prevCount === 0) {
      // 异步更新,不阻塞连接流程
      User.updateOne({ openid }, { $set: { status: 'online' } }).catch((err) => {
        console.error(`[Socket] 更新 ${openid} 为 online 失败:`, err);
      });
      // 广播上线通知，让好友列表实时更新
      io.emit('user:status-changed', { openid, status: 'online' });
      // 同步通知管理后台
      broadcastAdmin('admin:user-status', { openid, status: 'online' });
    }

    // 加入房间
    socket.on('room:join', async (roomId: string) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit('error', { message: '房间不存在' });
          return;
        }
        const inRoom = room.players.find(p => p.openid === openid);
        if (!inRoom) {
          socket.emit('error', { message: '不在房间内' });
          return;
        }
        socket.join(`room:${roomId}`);
        socket.to(`room:${roomId}`).emit('room:user-joined', { openid });
      } catch (err) {
        socket.emit('error', { message: '加入房间失败' });
      }
    });

    // 离开房间
    socket.on('room:leave', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-left', { openid });
    });

    // 房间状态变化通知（准备/开始/踢人等）
    socket.on('room:state-changed', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('room:state-changed', data);
    });

    // 绘画：开始一笔（透传整个 payload，前端可携带归一化坐标等扩展字段）
    socket.on('draw:start', (data: { roomId: string; point?: DrawPoint; color?: string; width?: number; [k: string]: any }) => {
      socket.to(`room:${data.roomId}`).emit('draw:start', data);
    });

    // 绘画：移动（连线）
    socket.on('draw:move', (data: { roomId: string; from: DrawPoint; to: DrawPoint }) => {
      socket.to(`room:${data.roomId}`).emit('draw:move', data);
    });

    // 绘画：结束一笔
    socket.on('draw:end', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('draw:end', data);
    });

    // 清空画板
    socket.on('draw:clear', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('draw:clear', data);
    });

    // 聊天消息
    socket.on('chat:message', (data: { roomId: string; openid: string; nickname: string; avatar: string; content: string; type: string }) => {
      socket.to(`room:${data.roomId}`).emit('chat:message', data);
    });

    // 玩家猜对：转发给房间内其他玩家，让他们同步分数 & 判断是否全员猜对
    socket.on('game:correct', (data: { roomId: string; openid: string; nickname: string; bonus: number }) => {
      socket.to(`room:${data.roomId}`).emit('game:correct', data);
    });

    // 游戏轮次开始
    socket.on('game:round-start', (data: { roomId: string; drawer: string; word: string; duration: number }) => {
      socket.to(`room:${data.roomId}`).emit('game:round-start', data);
    });

    // 游戏轮次结束
    socket.on('game:round-end', (data: { roomId: string; word: string }) => {
      socket.to(`room:${data.roomId}`).emit('game:round-end', data);
    });

    // 断开连接
    socket.on('disconnect', async () => {
      console.log(`[Socket] 用户断开: ${openid}`);
      // 引用计数 -1,归零时把 status 置 offline
      const cur = onlineSocketsCount.get(openid) || 0;
      const becameOffline = cur <= 1;
      if (becameOffline) {
        onlineSocketsCount.delete(openid);
        User.updateOne({ openid }, { $set: { status: 'offline' } }).catch((err) => {
          console.error(`[Socket] 更新 ${openid} 为 offline 失败:`, err);
        });
        // 广播下线通知（io 可能在闭包外，用 socket.broadcast 不够，需要 io.emit）
        io.emit('user:status-changed', { openid, status: 'offline' });
        // 玩家下线也通知管理员
        broadcastAdmin('admin:user-status', { openid, status: 'offline' });

        // 用户彻底下线后，从所有他所在的房间移除，并通知房间内其他玩家刷新。
        // 不移除的话，其他玩家会一直看到这个用户「还在房间里」。
        try {
          const rooms = await Room.find({ 'players.openid': openid });
          for (const room of rooms) {
            room.players = room.players.filter((p: any) => p.openid !== openid);
            if (room.players.length === 0) {
              // 房间空了，直接删除
              await Room.deleteOne({ _id: room._id });
              broadcastAdmin('admin:room-removed', { roomId: String(room._id), roomCode: room.roomCode });
            } else {
              // 房主断线，转给剩下的第一个玩家
              if (room.owner === openid) {
                const newOwner = room.players[0];
                newOwner.isOwner = true;
                room.owner = newOwner.openid;
                room.ownerNickname = newOwner.nickname;
              }
              await room.save();
              const roomObj = typeof room.toJSON === 'function'
                ? room.toJSON()
                : room.toObject();
              if (roomObj._id) roomObj._id = String(roomObj._id);
              delete (roomObj as any).__v;
              io.to(`room:${room._id}`).emit('room:updated', roomObj);
              broadcastAdmin('admin:room-updated', roomObj);
            }
          }
        } catch (err) {
          console.error(`[Socket] 清理 ${openid} 的房间失败:`, err);
        }
      } else {
        onlineSocketsCount.set(openid, cur - 1);
      }
    });
  });

  // 保存 io 引用，供 HTTP 路由调用
  ioRef = io;
  return io;
}

/**
 * 向所有在线管理后台广播事件
 */
export function broadcastAdmin(event: string, payload: unknown = undefined): void {
  if (!ioRef) return;
  try {
    if (payload === undefined) {
      (ioRef as SocketServer).to(ADMIN_ROOM).emit(event);
    } else {
      (ioRef as SocketServer).to(ADMIN_ROOM).emit(event, payload);
    }
  } catch (err) {
    console.error('[Socket] broadcastAdmin 失败:', err);
  }
}

/**
 * 暴露 io 实例引用，供业务层（需要灵活构造发送）使用
 */
export function getAdminSocketIo(): SocketServer | null {
  return ioRef;
}

/**
 * 判断用户是否在线（基于内存中的 socket 引用计数，实时准确）
 * 供 HTTP 接口使用，避免依赖异步更新的 User.status 字段
 */
export function isUserOnline(openid: string): boolean {
  return (onlineSocketsCount.get(openid) || 0) > 0;
}

/**
 * 获取当前在线用户总数
 */
export function getOnlineUserCount(): number {
  return onlineSocketsCount.size;
}
