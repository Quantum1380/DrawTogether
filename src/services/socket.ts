import { getToken, SOCKET_SERVER } from './cloud';

let socket: any = null;
let connecting: Promise<any> | null = null;

/** 建立 Socket.io 连接（登录后调用） */
export async function connectSocket(): Promise<any> {
  if (socket) return socket;
  if (connecting) return connecting;

  const token = getToken();
  if (!token) return null;

  connecting = (async () => {
    const { io } = await import('socket.io-client');
    const s = io(SOCKET_SERVER, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    s.on('connect', () => console.log('[Socket] 已连接'));
    s.on('connect_error', (err: any) => console.error('[Socket] 连接失败:', err.message));
    s.on('disconnect', () => console.log('[Socket] 已断开'));

    socket = s;
    return s;
  })();

  return connecting;
}

/** 获取当前 socket 实例 */
export function getSocket(): any {
  return socket;
}

/** 断开连接 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    connecting = null;
  }
}
