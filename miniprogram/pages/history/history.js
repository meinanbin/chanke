const api = require('../../utils/api.js')

Page({
  data: {
    searchKey: '',
    rawList: [],
    list: [],
    loading: true
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({ loading: true })
    api.fetchAuditLogs().then(logs => {
      // 按时间倒序（字符串字典序比较，避免 new Date() 解析非 ISO 格式问题）
      const sorted = (logs || []).slice().sort((a, b) => {
        const ta = a.operationTime || ''
        const tb = b.operationTime || ''
        if (ta !== tb) return tb < ta ? -1 : 1
        return 0
      })
      this.setData({ rawList: sorted, loading: false })
      this.applyFilter()
    }).catch(err => {
      console.error('[History] 获取审计日志失败：', err.message)
      this.setData({ rawList: [], list: [], loading: false })
    })
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
        (item.recordId || '').toLowerCase().includes(key) ||
        (item.operator || '').toLowerCase().includes(key) ||
        (item.recordType || '').toLowerCase().includes(key) ||
        (item.operation || '').toLowerCase().includes(key)
      )
    }
    this.setData({ list })
  }
})
