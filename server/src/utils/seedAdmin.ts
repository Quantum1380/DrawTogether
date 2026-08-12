import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin123';
const DEFAULT_NICKNAME = '超级管理员';

/** 启动时若无管理员账号,创建默认 super admin */
export async function seedAdmin() {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return;
    }
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await Admin.create({
      username: DEFAULT_USERNAME,
      password: hashed,
      nickname: DEFAULT_NICKNAME,
      role: 'super',
    });
    console.log('──────────────────────────────────────────');
    console.log('[Admin] 已创建默认管理员账号:');
    console.log(`  用户名: ${DEFAULT_USERNAME}`);
    console.log(`  密码:   ${DEFAULT_PASSWORD}`);
    console.log('  ⚠ 请登录后尽快修改密码!');
    console.log('──────────────────────────────────────────');
  } catch (err) {
    console.error('[Admin] seed 失败:', err);
  }
}
