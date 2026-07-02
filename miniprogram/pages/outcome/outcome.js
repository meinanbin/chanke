const storage = require('../../utils/storage.js')

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
    const records = storage.getAllOutcomeRecords()
    records.sort((a, b) => new Date(b.outcomeDate) - new Date(a.outcomeDate))
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

  onFilter() {},

  applyFilter() {
    let list = this.data.rawList
    if (this.data.searchKey) {
      const key = this.data.searchKey.toLowerCase()
      list = list.filter(item => item.animalId.toLowerCase().includes(key))
    }
    this.setData({ list })
  },

  onCreate() {
    wx.navigateTo({
      url: '/pages/outcome-form/outcome-form?mode=create'
    })
  }
})
