import { Room } from '../models/Room';

/**
 * 清理无用的房间数据:
 * 1. 游戏已结束(status='ended')的房间 —— 整局打完,玩家已散,不再使用
 * 2. 房间列表查询本身已排除 ended,但文档仍留在库里,启动时统一清掉
 *
 * 保留:
 * - waiting / playing 状态的房间(玩家可能还在用)
 * - 即使 ended 但 players 非空的房间也不删? 不,ended 即代表整局结束,
 *   玩家要重开会在返回房间页后重新点开始(此时 status 会被 /start 改回 playing)。
 *   但 ended 房间如果服务重启就没人能再返回了,所以启动时直接清。
 */
export async function cleanupEndedRooms(): Promise<number> {
  try {
    const result = await Room.deleteMany({ status: 'ended' });
    const deleted = result.deletedCount || 0;
    if (deleted > 0) {
      console.log(`[Cleanup] 已清理 ${deleted} 个已结束的房间`);
    }
    return deleted;
  } catch (err) {
    console.error('[Cleanup] 清理已结束房间失败:', err);
    return 0;
  }
}
