import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, generateUniqueUid } from '../models/User';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth';
import { broadcastAdmin } from '../socket';

const router = Router();

// 注册（用户名方式）
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      return res.json({ code: 1, message: '用户名和密码不能为空', data: null });
    }
    if (password.length < 6) {
      return res.json({ code: 1, message: '密码至少6位', data: null });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.json({ code: 1, message: '用户名已存在', data: null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // 显式生成 6 位 UID，确保查重，避免依赖 schema default（ObjectId 24位太长）
    const openid = await generateUniqueUid();
    const user = await User.create({
      openid,
      username,
      password: hashedPassword,
      nickname: nickname || username,
      status: 'online',
    });

    const token = generateToken(user._id.toString(), user.openid);
    const userData = user.toJSON();

    // 通知管理后台：新玩家注册（列表 + 数据总览需要实时更新）
    const payload: any = { ...userData };
    payload._id = String(payload._id);
    delete payload.password;
    delete payload.__v;
    broadcastAdmin('admin:player-registered', { player: payload });
    broadcastAdmin('admin:stats-changed', {});

    return res.json({
      code: 0,
      message: '注册成功',
      data: { token, user: userData },
    });
  } catch (err) {
    console.error('[Auth] register error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 注册（手机号方式）
// username 自动设为 UID（openid），用户用手机号+密码登录
router.post('/register-phone', async (req, res) => {
  try {
    const { phone, password, nickname } = req.body;

    if (!phone || !password) {
      return res.json({ code: 1, message: '手机号和密码不能为空', data: null });
    }
    if (password.length < 6) {
      return res.json({ code: 1, message: '密码至少6位', data: null });
    }
    // 基本手机号格式校验：去掉空格/横线后至少 7 位数字
    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    if (!/^\d{7,15}$/.test(cleanPhone)) {
      return res.json({ code: 1, message: '手机号格式不正确', data: null });
    }

    // 检查手机号是否已注册
    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) {
      return res.json({ code: 1, message: '该手机号已注册', data: null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const openid = await generateUniqueUid();
    // username = UID，这样手机号注册的用户 username 和 openid 一致
    const user = await User.create({
      openid,
      username: openid,
      password: hashedPassword,
      nickname: nickname || `用户${openid}`,
      phone: cleanPhone,
      status: 'online',
    });

    const token = generateToken(user._id.toString(), user.openid);
    const userData = user.toJSON();

    const payload: any = { ...userData };
    payload._id = String(payload._id);
    delete payload.password;
    delete payload.__v;
    broadcastAdmin('admin:player-registered', { player: payload });
    broadcastAdmin('admin:stats-changed', {});

    return res.json({
      code: 0,
      message: '注册成功',
      data: { token, user: userData },
    });
  } catch (err) {
    console.error('[Auth] register-phone error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 登录（兼容用户名和手机号）
// 输入框接受 username 或 phone，后端先按 username 查，查不到再按 phone 查
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ code: 1, message: '用户名和密码不能为空', data: null });
    }

    // 先按 username 查
    let user = await User.findOne({ username });
    // 查不到则按 phone 查（手机号注册的用户用手机号登录）
    if (!user) {
      const cleanPhone = String(username).replace(/[\s-]/g, '');
      user = await User.findOne({ phone: cleanPhone });
    }
    if (!user) {
      return res.json({ code: 1, message: '用户不存在', data: null });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ code: 1, message: '密码错误', data: null });
    }

    // 拒绝被封禁用户登录
    if (user.banStatus?.banned) {
      return res.json({
        code: 1,
        message: `账号已被封禁: ${user.banStatus.banReason || '违规行为'}`,
        data: null,
      });
    }

    user.status = 'online';
    await user.save();

    const token = generateToken(user._id.toString(), user.openid);
    const userData = user.toJSON();

    return res.json({
      code: 0,
      message: '登录成功',
      data: { token, user: userData },
    });
  } catch (err) {
    console.error('[Auth] login error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 获取当前用户信息
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ openid: req.openid });
    if (!user) {
      return res.json({ code: 1, message: '用户不存在', data: null });
    }
    return res.json({ code: 0, message: 'ok', data: user.toJSON() });
  } catch (err) {
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 更新用户资料
router.post('/profile/update', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { nickname, avatar, phone } = req.body;
    const update: Record<string, any> = {};
    if (nickname !== undefined) update.nickname = nickname;
    if (avatar !== undefined) update.avatar = avatar;
    if (phone !== undefined) update.phone = phone;

    const user = await User.findOneAndUpdate(
      { openid: req.openid },
      { $set: update },
      { new: true }
    );
    if (!user) {
      return res.json({ code: 1, message: '用户不存在', data: null });
    }
    return res.json({ code: 0, message: '更新成功', data: user.toJSON() });
  } catch (err) {
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 退出登录
router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await User.updateOne({ openid: req.openid }, { $set: { status: 'offline' } });
    return res.json({ code: 0, message: '已退出', data: null });
  } catch (err) {
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

export default router;
