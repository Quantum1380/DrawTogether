/**
 * 解除通讯录授权 script
 * 直接 POST 一个请求到后端，把授权状态设置为 denied
 *
 * 用法：
 *   npm run reset:contacts
 *   或：node scripts/reset-contacts-permission.mjs
 */

const BACKEND_URL = 'http://localhost:3000/api/dev/contacts-permission';

const res = await fetch(BACKEND_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ state: 'unknown' }),
});

const data = await res.json();

console.log('========================================');
console.log('  解除通讯录授权');
console.log('========================================');
console.log('');
console.log('请求:', `POST ${BACKEND_URL}`);
console.log('Body:', JSON.stringify({ state: 'unknown' }));
console.log('');
console.log('响应:', JSON.stringify(data, null, 2));
console.log('');
if (data.code === 0) {
  console.log('✓ 授权状态已重置为 unknown');
  console.log('  下次进入通讯录页会重新弹出 iPhone 授权弹窗');
} else {
  console.log('✗ 设置失败，请确认后端 dev server 已启动（http://localhost:3000）');
}
