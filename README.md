# 你画我猜 (Draw & Guess)

一款基于 Taro 4.x + React + TypeScript 开发的跨平台你画我猜小游戏，支持微信小程序、H5、App 多端运行。

## 功能特性

- 🎨 **实时画板** — 支持多色画笔、多种笔刷、橡皮擦、清空画布
- 🏠 **房间系统** — 创建/加入房间，最多 6 人同场游戏
- 👥 **好友系统** — 好友列表、在线状态、通讯录同步
- 💬 **邀请好友** — 房间内直接邀请好友加入游戏
- 🏆 **计分排名** — 实时计分、回合结算、胜负排行
- 📱 **多端适配** — 微信小程序 / H5 / iOS / Android

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Taro 4.x |
| UI | React 18 + TypeScript |
| 样式 | SCSS + CSS Modules |
| 状态管理 | Zustand |
| 后端 | 微信云开发（云函数 + 云数据库） |
| 构建 | Webpack 5 |

## 项目结构

```
game3/
├── cloudfunctions/          # 微信云函数
│   ├── login/              # 登录鉴权
│   ├── getUserProfile/     # 获取用户信息
│   ├── updateUserProfile/  # 更新用户资料
│   ├── createRoom/         # 创建房间
│   ├── joinRoom/           # 加入房间
│   ├── leaveRoom/          # 离开房间
│   ├── startGame/          # 开始游戏
│   ├── toggleReady/        # 准备/取消准备
│   ├── getFriends/         # 获取好友列表
│   ├── addFriend/          # 添加好友
│   ├── inviteFriend/       # 邀请好友
│   ├── syncContacts/       # 同步通讯录
│   ├── getMessages/        # 获取消息列表
│   ├── readMessages/       # 标记消息已读
│   ├── getMyRooms/         # 获取我的房间
│   └── getRoomById/        # 获取房间详情
├── src/
│   ├── assets/             # 静态资源（图标、图片）
│   │   └── tabbar/         # TabBar 图标
│   ├── components/         # 公共组件
│   │   ├── Avatar/         # 头像组件
│   │   ├── FriendItem/     # 好友列表项
│   │   └── InviteModal/    # 邀请弹窗
│   ├── data/               # Mock 数据
│   ├── pages/              # 页面
│   │   ├── index/          # 首页（创建/加入房间）
│   │   ├── room/           # 房间大厅
│   │   ├── game/           # 游戏页（画板 + 猜词）
│   │   ├── friends/        # 好友列表
│   │   ├── contacts/       # 通讯录同步
│   │   ├── message/        # 消息中心
│   │   └── mine/           # 个人中心
│   ├── services/           # 服务层（API 封装）
│   │   └── friendService.ts
│   ├── store/              # 全局状态（Zustand）
│   │   └── userStore.ts
│   ├── types/              # TypeScript 类型定义
│   ├── app.config.ts       # 应用配置
│   ├── app.tsx             # 应用入口
│   └── index.html          # H5 入口
├── config/                 # Taro 构建配置
│   ├── index.ts
│   ├── dev.ts
│   └── prod.ts
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 16
- npm / yarn
- 微信开发者工具（小程序调试）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# H5 网页预览
npm run dev:h5

# 微信小程序
npm run dev:weapp

# 支付宝小程序
npm run dev:alipay

# 百度小程序
npm run dev:swan

# 字节跳动小程序
npm run dev:tt

# QQ 小程序
npm run dev:qq
```

### 生产构建

```bash
# H5
npm run build:h5

# 微信小程序
npm run build:weapp

# App (React Native)
npm run build:rn
```

## 云开发配置

1. 在微信开发者工具中开通云开发
2. 创建以下云数据库集合：
   - `users` — 用户信息
   - `rooms` — 房间数据
   - `friends` — 好友关系
   - `messages` — 消息记录
   - `contacts` — 通讯录同步
3. 将 `cloudfunctions/` 目录下的云函数逐个上传部署
4. 在 `src/app.tsx` 中初始化云开发环境：

```typescript
if (process.env.TARO_ENV === 'weapp') {
  Taro.cloud.init({
    env: 'your-env-id',
  });
}
```

## 页面说明

### 首页 (`pages/index`)
- 创建房间（自动生成 6 位房间号）
- 输入房间号加入已有房间
- 显示最近游戏记录

### 房间大厅 (`pages/room`)
- 玩家列表（最多 6 人）
- 准备/取消准备
- 邀请好友（跳转好友选择页）
- 复制房间号分享
- 房主可开始游戏

### 游戏页 (`pages/game`)
- Canvas 画板（12 色画笔、3 种笔刷、橡皮擦）
- 60 秒倒计时
- 实时聊天与猜词
- 回合结算与计分
- 多轮游戏支持

### 好友列表 (`pages/friends`)
- 好友搜索
- 在线/离线/忙碌状态筛选
- 一键邀请好友进房间
- 跳转到通讯录同步页

### 通讯录同步 (`pages/contacts`)
- 读取手机通讯录
- 自动识别已注册好友
- 一键添加好友
- 邀请未注册好友下载

### 消息中心 (`pages/message`)
- 接收房间邀请
- 接受/拒绝邀请
- 系统通知
- 未读消息标记

### 个人中心 (`pages/mine`)
- 编辑资料（昵称、头像）
- 游戏统计（胜场、胜率、得分）
- 通讯录同步入口

## Mock 模式

在 H5 预览时，若未配置云开发环境，系统会自动使用 Mock 数据：
- 首页显示模拟房间列表
- 好友列表显示预设好友
- 游戏页模拟其他玩家猜词

## 多端适配说明

| 功能 | H5 | 小程序 | App (RN) |
|------|-----|--------|----------|
| Canvas 画板 | ✅ 已适配 | ✅ 已适配 | ⚠️ 需改用 react-native-canvas |
| 通讯录 | ✅ 浏览器 API | ✅ wx API | ⚠️ 需原生插件 |
| 云开发 | ❌ 需 HTTP 改造 | ✅ 原生支持 | ❌ 需 HTTP 改造 |
| 触摸事件 | ✅ 已适配 | ✅ 已适配 | ✅ 已适配 |

## License

MIT