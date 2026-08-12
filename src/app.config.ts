export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/friends/index',
    'pages/message/index',
    'pages/mine/index',
    'pages/room/index',
    'pages/game/index',
    'pages/contacts/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '你画我猜',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#9CA3AF',
    selectedColor: '#6366F1',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.svg',
        selectedIconPath: 'assets/tabbar/home-selected.svg'
      },
      {
        pagePath: 'pages/friends/index',
        text: '好友',
        iconPath: 'assets/tabbar/friends.svg',
        selectedIconPath: 'assets/tabbar/friends-selected.svg'
      },
      {
        pagePath: 'pages/message/index',
        text: '消息',
        iconPath: 'assets/tabbar/message.svg',
        selectedIconPath: 'assets/tabbar/message-selected.svg'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.svg',
        selectedIconPath: 'assets/tabbar/mine-selected.svg'
      }
    ]
  }
})
