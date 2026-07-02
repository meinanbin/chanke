const storage = require('../../utils/storage.js')

Page({
  data: {
    animalId: '',
    animal: null,
    latestBRecord: null,
    latestNonBRecord: null,
    latestOutcome: null,
    activeTab: 0, // 0: B超历史, 1: 非B超历史, 2: 妊娠结局
    bHistory: [],
    nonBHistory: [],
    outcomeHistory: []
  },

  onLoad(options) {
    this.setData({ animalId: options.animalId })
    this.loadData()
  },

  onShow() {
    if (this.data.animalId) {
      this.loadData()
    }
  },

  loadData() {
    const animalId = this.data.animalId
    const animal = storage.getAnimalById(animalId)
    const bRecords = storage.getBRecordsByAnimalDesc(animalId)
    const nonBRecords = storage.getNonBRecordsByAnimalDesc(animalId)
    const outcomeRecords = storage.getOutcomeRecordsByAnimalDesc(animalId)

    // 获取汇总记录的高风险标签，与列表页保持一致
    const summaryList = storage.getSummaryList()
    const summaryRecord = summaryList.find(s => s.animalId === animalId)
    const mergedRiskTags = summaryRecord ? summaryRecord.mergedRiskTags || [] : []

    // 计算动态超期标签（基于当前系统日期，所有记录共享）
    const overdueTags = storage.getOverdueTags(animalId)

    // 处理最新B超记录
    const latestB = bRecords[0] || null
    if (latestB) {
      // 胎盘位置数组转展示字符串
      if (Array.isArray(latestB.placentaPosition)) {
        latestB.placentaPositionText = latestB.placentaPosition.join('、')
      } else if (latestB.placentaPosition) {
        latestB.placentaPositionText = latestB.placentaPosition
      }
      // 合并记录固有标签 + 动态超期标签
      latestB.displayRiskTags = this.mergeTags(latestB.riskTags, overdueTags)
    }

    // 处理最新非B超记录
    const latestNonB = nonBRecords[0] || null
    if (latestNonB) {
      latestNonB.displayRiskTags = this.mergeTags(latestNonB.riskTags, overdueTags)
    }

    // 历史记录：只展示该条记录创建时的静态标签，不包含动态超期标签
    const bHistory = bRecords.map(r => {
      const item = Object.assign({}, r)
      item.displayRiskTags = item.riskTags || []
      return item
    })
    const nonBHistory = nonBRecords.map(r => {
      const item = Object.assign({}, r)
      item.displayRiskTags = item.riskTags || []
      return item
    })

    this.setData({
      animal,
      mergedRiskTags,
      latestBRecord: latestB,
      latestNonBRecord: latestNonB,
      latestOutcome: outcomeRecords[0] || null,
      bHistory,
      nonBHistory,
      outcomeHistory: outcomeRecords
    })
  },

  mergeTags(recordTags, overdueTags) {
    var tags = []
    if (recordTags && Array.isArray(recordTags)) {
      for (var i = 0; i < recordTags.length; i++) {
        var t = recordTags[i]
        if (tags.indexOf(t) === -1) tags.push(t)
      }
    }
    if (overdueTags && Array.isArray(overdueTags)) {
      for (var j = 0; j < overdueTags.length; j++) {
        var t2 = overdueTags[j]
        if (tags.indexOf(t2) === -1) tags.push(t2)
      }
    }
    // 互斥规则：超预产期3天 与 超预产期15天 不共存，优先保留"超预产期15天"
    var over15Idx = tags.indexOf('超预产期15天')
    var over3Idx = tags.indexOf('超预产期3天')
    if (over15Idx !== -1 && over3Idx !== -1) {
      tags.splice(over3Idx, 1)
    }
    return tags
  },

  // 切换Tab（dataset.index 是字符串，需转数字）
  onTabChange(e) {
    this.setData({ activeTab: parseInt(e.currentTarget.dataset.index) })
  },

  // 搜索（返回汇总列表搜索）
  onSearchChange() {
    // 详情页搜索框仅展示当前动物编号，不触发搜索
  },

  onSearch() {
    // 同上
  },

  onFilter() {
    // 详情页无筛选
  },

  // 查看B超记录详情
  onBRecordTap(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    wx.navigateTo({
      url: `/pages/b-ultrasound-form/b-ultrasound-form?id=${id}&mode=view`
    })
  },

  // 查看非B超记录详情
  onNonBRecordTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/non-b-ultrasound-form/non-b-ultrasound-form?id=${id}&mode=view`
    })
  }
})
