const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 64,
    userName: '',
    userRole: '',
    menus: [
      {
        key: 'summary',
        title: '产科检查汇总',
        subtitle: '查看所有动物档案',
        icon: 'list',
        color: '#4A90D9',
        bgColor: '#E8F2FE',
        url: '/pages/summary/summary'
      },
      {
        key: 'b-ultrasound',
        title: 'B超检查',
        subtitle: '超声影像检查记录',
        icon: 'ultrasound',
        color: '#FF6B6B',
        bgColor: '#FFF1F0',
        url: '/pages/b-ultrasound/b-ultrasound'
      },
      {
        key: 'non-b-ultrasound',
        title: '非B超检查',
        subtitle: '胎位/产道检查记录',
        icon: 'stethoscope',
        color: '#52C41A',
        bgColor: '#F6FFED',
        url: '/pages/non-b-ultrasound/non-b-ultrasound'
      },
      {
        key: 'outcome',
        title: '妊娠结局登记',
        subtitle: '登记分娩/流产等结局',
        icon: 'flag',
        color: '#FAAD14',
        bgColor: '#FFF7E6',
        url: '/pages/outcome/outcome'
      },
      {
        key: 'admin-lists',
        title: '特殊清单管理',
        subtitle: '弱猴/剖腹产动物维护',
        icon: 'list',
        color: '#722ED1',
        bgColor: '#F9F0FF',
        url: '/pages/admin-lists/admin-lists'
      }
    ]
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      navBarHeight: (info.statusBarHeight || 20) + 44
    })
  },

  onShow() {
    const user = app.globalData.currentUser
    if (user) {
      this.setData({
        userName: user.name,
        userRole: user.role
      })
    }
  },

  // 点击菜单
  onMenuTap(e) {
    const url = e.currentTarget.dataset.url
    wx.navigateTo({ url })
  },

  // 个人中心
  onProfileTap() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  }
})
