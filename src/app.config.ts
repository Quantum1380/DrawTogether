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
    navigationBarTitleText: 'Draw Together',
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
        text: 'Home',
        iconPath: 'assets/tabbar/home.svg',
        selectedIconPath: 'assets/tabbar/home-selected.svg'
      },
      {
        pagePath: 'pages/friends/index',
        text: 'Friends',
        iconPath: 'assets/tabbar/friends.svg',
        selectedIconPath: 'assets/tabbar/friends-selected.svg'
      },
      {
        pagePath: 'pages/message/index',
        text: 'Messages',
        iconPath: 'assets/tabbar/message.svg',
        selectedIconPath: 'assets/tabbar/message-selected.svg'
      },
      {
        pagePath: 'pages/mine/index',
        text: 'Me',
        iconPath: 'assets/tabbar/mine.svg',
        selectedIconPath: 'assets/tabbar/mine-selected.svg'
      }
    ]
  }
})
