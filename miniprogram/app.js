const storage = require('./utils/storage.js')
const specialLists = require('./utils/special-lists.js')

App({
  globalData: {
    currentUser: null,
    systemInfo: null
  },

  onLaunch() {
    // 获取系统信息
    const sysInfo = wx.getWindowInfo()
    this.globalData.systemInfo = sysInfo

    // 初始化当前用户（模拟登录）
    let user = wx.getStorageSync('currentUser')
    if (!user) {
      user = {
        id: 'U001',
        name: '张兽医',
        role: '兽医',
        ip: '192.168.1.100'
      }
      wx.setStorageSync('currentUser', user)
    }
    this.globalData.currentUser = user

    // 初始化特殊清单（弱猴/剖腹产），不影响主流程
    specialLists.initSpecialLists().catch(err => {
      console.warn('[App] 特殊清单加载失败：', err.message)
    })

    // 初始化存储：从远程服务器同步数据到本地缓存（异步）
    storage.initStorage().then(synced => {
      if (synced) {
        console.log('[App] 远程数据同步成功')
      } else {
        console.log('[App] 远程同步失败，使用本地缓存')
      }
    })
  }
})
