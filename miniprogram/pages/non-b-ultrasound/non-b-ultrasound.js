const storage = require('../../utils/storage.js')
const excelExport = require('../../utils/excel-export.js')

Page({
  data: {
    searchKey: '',
    rawList: [],
    list: []
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const records = storage.getAllNonBRecords()
    records.sort((a, b) => new Date(b.operationDate) - new Date(a.operationDate))
    this.setData({ rawList: records })
    this.applyFilter()
  },

  onSearchChange(e) {
    this.setData({ searchKey: e.detail.value })
    this.applyFilter()
  },

  onSearch(e) {
    this.setData({ searchKey: e.detail.value })
    this.applyFilter()
  },

  onFilter() {
    // 预留筛选
  },

  applyFilter() {
    let list = this.data.rawList
    if (this.data.searchKey) {
      const key = this.data.searchKey.toLowerCase()
      list = list.filter(item => item.animalId.toLowerCase().includes(key))
    }
    this.setData({ list })
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const mode = status === '锁定' ? 'view' : 'edit'
    wx.navigateTo({
      url: `/pages/non-b-ultrasound-form/non-b-ultrasound-form?id=${id}&mode=${mode}`
    })
  },

  onCreate() {
    wx.navigateTo({
      url: '/pages/non-b-ultrasound-form/non-b-ultrasound-form?mode=create'
    })
  },

  // 导出数据
  onExport() {
    if (this.data.list.length === 0) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' })
      return
    }
    excelExport.exportNonBUltrasound(this.data.list)
  }
})
