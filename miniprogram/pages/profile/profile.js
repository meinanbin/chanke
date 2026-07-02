const app = getApp()
const storage = require('../../utils/storage.js')

Page({
  data: {
    statusBarHeight: 20,
    user: null,
    stats: {
      animalCount: 0,
      bRecordCount: 0,
      nonBRecordCount: 0,
      outcomeCount: 0
    }
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    const user = app.globalData.currentUser
    const animals = storage.getAllAnimals()
    const bRecords = storage.getAllBRecords()
    const nonBRecords = storage.getAllNonBRecords()
    const outcomes = storage.getAllOutcomeRecords()

    this.setData({
      user,
      stats: {
        animalCount: animals.length,
        bRecordCount: bRecords.length,
        nonBRecordCount: nonBRecords.length,
        outcomeCount: outcomes.length
      }
    })
  },

  onHistoryTap() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/home/home' })
    })
  }
})
