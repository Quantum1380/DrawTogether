/**
 * 手动清理已结束的房间(status='ended')
 * 调用后端 dev 接口删除所有游戏已结束、玩家已散的房间
 *
 * 用法：
 *   npm run cleanup:rooms
 *   或：node scripts/cleanup-rooms.mjs
 */

const BACKEND_URL = 'http://localhost:3000/api/dev/cleanup-rooms';

console.log('========================================');
console.log('  清理已结束的房间');
console.log('========================================');
console.log('');

try {
  // 先查一下当前房间统计
  const statsRes = await fetch('http://localhost:3000/api/dev/rooms-stats');
  const statsData = await statsRes.json();
  if (statsData.code === 0) {
    const { waiting, playing, ended, total } = statsData.data;
    console.log(`当前房间统计:`);
    console.log(`  等待中(waiting): ${waiting}`);
    console.log(`  游戏中(playing): ${playing}`);
    console.log(`  已结束(ended):   ${ended}`);
    console.log(`  总计:            ${total}`);
    console.log('');
    if (ended === 0) {
      console.log('✓ 没有需要清理的已结束房间');
      process.exit(0);
    }
  }

  console.log(`正在清理 ${statsData.data?.ended || ''} 个已结束房间...`);
  const res = await fetch(BACKEND_URL, { method: 'POST' });
  const data = await res.json();
  console.log('响应:', JSON.stringify(data, null, 2));
  console.log('');
  if (data.code === 0) {
    console.log(`✓ ${data.message}`);
  } else {
    console.log('✗ 清理失败，请确认后端 dev server 已启动（http://localhost:3000）');
  }
} catch (err) {
  console.log('✗ 请求失败，请确认后端 dev server 已启动（http://localhost:3000）');
  console.log('  错误:', err.message);
}
