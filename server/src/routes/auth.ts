import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, generateUniqueUid } from '../models/User';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth';
import { broadcastAdmin } from '../socket';

const router = Router();

// 注册（手机号方式）
// username 自动设为 UID（openid）
router.post('/register', async (req, res) => {
  try {
    const { phone, password, nickname } = req.body;

    if (!phone || !password) {
      return res.json({ code: 1, message: '手机号和密码不能为空', data: null });
    }
    if (password.length < 6) {
      return res.json({ code: 1, message: '密码至少6位', data: null });
    }
    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    if (!/^\d{7,15}$/.test(cleanPhone)) {
      return res.json({ code: 1, message: '手机号格式不正确', data: null });
    }

    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) {
      return res.json({ code: 1, message: '该手机号已注册', data: null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const openid = await generateUniqueUid();
    const user = await User.create({
      openid,
      username: openid,
      password: hashedPassword,
      nickname: nickname || `User${openid}`,
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
    console.error('[Auth] register error:', err);
    return res.json({ code: 1, message: '服务器错误', data: null });
  }
});

// 登录（手机号+密码）
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.json({ code: 1, message: '手机号和密码不能为空', data: null });
    }

    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.json({ code: 1, message: '该手机号未注册', data: null });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ code: 1, message: '密码错误', data: null });
    }

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
