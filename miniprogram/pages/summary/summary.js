const storage = require('../../utils/storage.js')
const excelExport = require('../../utils/excel-export.js')

Page({
  data: {
    searchKey: '',
    filterStatus: '', // 筛选状态：在孕/未孕/已结案
    showFilter: false,
    viewMode: 'all', // 视图模式：all / needRecheck
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
    const list = storage.getSummaryList()
    this.setData({ rawList: list })
    this.applyFilter()
  },

  // 搜索变化
  onSearchChange(e) {
    this.setData({ searchKey: e.detail.value })
    this.applyFilter()
  },

  // 搜索确认
  onSearch(e) {
    this.setData({ searchKey: e.detail.value })
    this.applyFilter()
  },

  // 筛选
  onFilter() {
    this.setData({ showFilter: !this.data.showFilter })
  },

  onFilterSelect(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ filterStatus: status, showFilter: false })
    this.applyFilter()
  },

  // 视图切换
  onSwitchView(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
    this.applyFilter()
  },

  // 判断动物是否符合"当前需复检"条件
  // 前置条件：动物当前妊娠状态必须为"在孕"
  // 返回 true/false
  needRecheck(item) {
    // 前置条件
    if (item.status !== '在孕') return false

    const tags = item.mergedRiskTags || []
    const bDays = item.bDaysSince  // B超距今检查天数（可能为 null）
    const nonBDays = item.nonBDaysSince  // 非B超距今检查天数（可能为 null）
    // 复检规则使用 B超距今检查天数（规则描述中均使用此值）
    const days = bDays

    // 若 B超记录不存在，无法判断，跳过
    if (days === null) return false

    // 辅助：标签是否存在
    function hasTag(tag) { return tags.indexOf(tag) !== -1 }

    // 规则1：胎位不正 AND B超距今检查 ≥ 1
    if (hasTag('胎位不正') && days >= 1) return true

    // 规则2：胎位多变 AND B超距今检查 ≥ 1
    if (hasTag('胎位多变') && days >= 1) return true

    // 规则3：胎心弱 AND B超距今检查 ≥ 1
    if (hasTag('胎心弱') && days >= 1) return true

    // 规则4：标准胎龄 ≥ 145 AND B超距今检查 ≥ 1 AND 胎盘前置
    if (item.currentStandardAge !== null && item.currentStandardAge >= 145 && days >= 1 && hasTag('胎盘前置')) return true

    // 规则5：双顶径 ≥ 4.3 AND B超距今检查 ≥ 1 AND 胎盘前置
    var bpd = item.latestBRecord ? parseFloat(item.latestBRecord.bpd) : null
    if (bpd !== null && !isNaN(bpd) && bpd >= 4.3 && days >= 1 && hasTag('胎盘前置')) return true

    // 规则6：标准胎龄 ≥ 140 AND 标准胎龄 < 145 AND B超距今检查 ≥ 7 AND 胎盘前置
    if (item.currentStandardAge !== null && item.currentStandardAge >= 140 && item.currentStandardAge < 145 && days >= 7 && hasTag('胎盘前置')) return true

    // 规则7：羊水异常 AND B超距今检查 ≥ 1
    if (hasTag('羊水异常') && days >= 1) return true

    // 规则8：标准胎龄 ≥ 140 AND B超距今检查 ≥ 7 AND 产道/子宫异常
    if (item.currentStandardAge !== null && item.currentStandardAge >= 140 && days >= 7 && hasTag('产道/子宫异常')) return true

    // 规则9：标准胎龄 ≥ 140 AND B超距今检查 ≥ 7 AND 兽医认定高危
    if (item.currentStandardAge !== null && item.currentStandardAge >= 140 && days >= 7 && hasTag('兽医认定高危')) return true

    // 规则10：标准胎龄 ≥ 140 AND B超距今检查 ≥ 7 AND 头径大于4.8
    if (item.currentStandardAge !== null && item.currentStandardAge >= 140 && days >= 7 && hasTag('头径大于4.8')) return true

    // 规则11：超预产期3天 AND B超距今检查 ≥ 7
    if (hasTag('超预产期3天') && days >= 7) return true

    // 规则12：超预产期15天 AND B超距今检查 ≥ 1
    if (hasTag('超预产期15天') && days >= 1) return true

    return false
  },

  // 应用筛选
  applyFilter() {
    let list = this.data.rawList

    // 搜索过滤
    if (this.data.searchKey) {
      const key = this.data.searchKey.toLowerCase()
      list = list.filter(item =>
        item.animalId.toLowerCase().includes(key)
      )
    }

    // 状态筛选
    if (this.data.filterStatus) {
      list = list.filter(item => item.status === this.data.filterStatus)
    }

    // 视图筛选：当前需复检
    if (this.data.viewMode === 'needRecheck') {
      list = list.filter(item => this.needRecheck(item))
    }

    // 视图筛选：高风险在孕（状态为在孕且存在任意高风险标签）
    if (this.data.viewMode === 'highRiskPregnant') {
      list = list.filter(item => item.status === '在孕' && item.mergedRiskTags && item.mergedRiskTags.length > 0)
    }

    // 视图筛选：疑似怀孕
    if (this.data.viewMode === 'suspectedPregnant') {
      list = list.filter(item => item.status === '疑似怀孕')
    }

    this.setData({ list })
  },

  // 查看详情
  onItemTap(e) {
    const animalId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/summary-detail/summary-detail?animalId=${animalId}`
    })
  },

  // 删除该动物编号下的所有记录
  onDeleteAnimal(e) {
    const animalId = e.currentTarget.dataset.id

    // 二次确认
    wx.showModal({
      title: '删除确认',
      content: `确定要删除动物编号「${animalId}」的所有记录吗？\n此操作将删除该动物下的B超、非B超、妊娠结局记录及档案，且不可恢复。`,
      confirmText: '下一步',
      cancelText: '取消',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (!res.confirm) return

        // 密码验证
        wx.showModal({
          title: '权限验证',
          content: '请输入管理员密码以确认删除',
          editable: true,
          placeholderText: '请输入密码',
          confirmText: '确认删除',
          cancelText: '取消',
          confirmColor: '#FF4D4F',
          success: (pwdRes) => {
            if (!pwdRes.confirm) return

            if (pwdRes.content !== 'administrator') {
              wx.showToast({ title: '密码错误', icon: 'error' })
              return
            }

            // 执行删除（异步）
            wx.showLoading({ title: '删除中...' })
            storage.deleteAnimalAllRecords(animalId).then(() => {
              wx.hideLoading()
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadData()
            }).catch(err => {
              wx.hideLoading()
              wx.showModal({ title: '删除失败', content: err.message || '未知错误', showCancel: false })
            })
          }
        })
      }
    })
  },

  // 导出数据
  onExport() {
    if (this.data.list.length === 0) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' })
      return
    }
    excelExport.exportSummary(this.data.list)
  },

  // 新建B超检查
  onNewBUltrasound() {
    wx.navigateTo({
      url: '/pages/b-ultrasound-form/b-ultrasound-form?mode=create'
    })
  }
})
