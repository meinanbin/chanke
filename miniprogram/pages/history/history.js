const audit = require('../../utils/audit.js')

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
    const logs = audit.getAllLogs()
    // 按时间倒序
    logs.sort((a, b) => new Date(b.operationTime) - new Date(a.operationTime))
    this.setData({ rawList: logs })
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
      list = list.filter(item =>
        item.recordId.toLowerCase().includes(key) ||
        item.operator.toLowerCase().includes(key) ||
        (item.recordType && item.recordType.toLowerCase().includes(key))
      )
    }
    this.setData({ list })
  }
})
