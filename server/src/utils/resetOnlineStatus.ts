import { User } from '../models/User';

/**
 * 服务启动时重置在线状态
 *
 * 背景:Socket 在线状态用内存 Map 跟踪 (onlineSocketsCount),
 * 服务重启后 Map 被清空,但数据库里可能还残留 status='online' 的用户。
 * 重启后没有任何 socket 是真正活动的,所以应该把所有 online 重置为 offline,
 * 等客户端重连后由 connection 事件重新置为 online。
 *
 * 注意:这会有一小段时间窗口(从重启到客户端重连成功)所有用户都显示 offline,
 * 这是预期行为 —— 因为这段时间确实没有任何 socket 连接。
 */
export async function resetOnlineStatusOnBoot(): Promise<number> {
  try {
    const result = await User.updateMany(
      { status: 'online' },
      { $set: { status: 'offline' } }
    );
    const modified = result.modifiedCount || 0;
    if (modified > 0) {
      console.log(`[Boot] 重置 ${modified} 个用户的旧在线状态为 offline`);
    }
    return modified;
  } catch (err) {
    console.error('[Boot] 重置在线状态失败:', err);
    return 0;
  }
}
