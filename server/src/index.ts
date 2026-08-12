import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { config, isOriginAllowed } from './config';
import authRoutes from './routes/auth';
import { createRoomRouter } from './routes/room';
import { createAdminRouter } from './routes/admin';
import friendRoutes from './routes/friend';
import { createMessageRouter } from './routes/message';
import { createDevRouter } from './routes/dev';
import { setupSocket } from './socket';
import { seedAdmin } from './utils/seedAdmin';
import { cleanupEndedRooms } from './utils/cleanupRooms';
import { resetOnlineStatusOnBoot } from './utils/resetOnlineStatus';

async function startServer() {
  // 连接 MongoDB
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[MongoDB] 连接成功');
  } catch (err) {
    console.error('[MongoDB] 连接失败:', err);
    console.error('请确保 MongoDB 已启动（本地默认端口 27017）');
    process.exit(1);
  }

  // seed 默认管理员账号(已存在则跳过)
  await seedAdmin();
  // 清理上次遗留的已结束房间(status='ended',玩家已散,不再使用)
  await cleanupEndedRooms();
  // 重启后内存在线表已清空,把所有残留 online 重置为 offline,等客户端重连后重建
  await resetOnlineStatusOnBoot();

  const app = express();

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // 统一使用 isOriginAllowed 判断（支持精确匹配 + ngrok/cpolar 通配域名）
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} 不在 CORS 白名单中`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Length', 'Content-Disposition'],
    optionsSuccessStatus: 204,
  };

  // CORS 中间件
  app.use(cors(corsOptions));

  // 显式处理所有 OPTIONS 预检请求，作为 cors 中间件的安全兜底
  // 确保每个预检响应都包含完整的 CORS 头，避免浏览器因缺少头而拦截实际请求
  app.options('*', (req, res) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      if (config.clientOrigin.includes(origin) || origin.endsWith('.ngrok-free.dev')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API 路由
  app.use('/api/auth', authRoutes);
  app.use('/api/friends', friendRoutes);

  // 创建 HTTP 服务器并挂载 Socket.io
  const httpServer = http.createServer(app);
  const io = setupSocket(httpServer);

  // rooms/messages 路由依赖 io，用于实时推送
  app.use('/api/rooms', createRoomRouter(io));
  app.use('/api/messages', createMessageRouter(io));

  // 管理后台路由(独立鉴权)
  app.use('/api/admin', createAdminRouter(io));

  // dev 测试路由（通讯录授权状态读写）
  app.use('/api/dev', createDevRouter());

  httpServer.listen(config.port, () => {
    console.log(`[Server] 服务已启动: http://localhost:${config.port}`);
    console.log(`[Socket.io] 实时通信就绪`);
    console.log(`[CORS] 允许来源: ${config.clientOrigin}`);
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
