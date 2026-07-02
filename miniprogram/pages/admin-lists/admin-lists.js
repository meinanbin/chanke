/**
 * 特殊清单管理页面
 * 支持弱猴 / 剖腹产清单的查看、添加、删除、搜索
 */

const api = require('../../utils/api.js')
const specialLists = require('../../utils/special-lists.js')
const storage = require('../../utils/storage.js')

Page({
  data: {
    listType: 'weak_monkey',  // 当前清单类型
    rawList: [],              // 原始清单数据（含 addedAt 等）
    filteredList: [],         // 经搜索过滤后展示
    searchKey: '',
    showAddModal: false,
    newAnimalId: ''
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    // 从其他页面返回时刷新一次
    this.loadList()
  },

  // 加载清单
  loadList() {
    wx.showLoading({ title: '加载中...', mask: true })
    api.fetchSpecialLists(this.data.listType)
      .then(records => {
        const list = (records || []).map(r => ({
          animalId: r.animalId,
          addedAt: r.addedAt || '',
          addedBy: r.addedBy || '',
          remark: r.remark || ''
        }))
        this.setData({ rawList: list })
        this.applyFilter()
      })
      .catch(err => {
        wx.showModal({ title: '加载失败', content: err.message || '未知错误', showCancel: false })
      })
      .then(() => wx.hideLoading())
  },

  applyFilter() {
    const key = (this.data.searchKey || '').trim().toLowerCase()
    const filtered = key
      ? this.data.rawList.filter(x => x.animalId.toLowerCase().includes(key))
      : this.data.rawList
    this.setData({ filteredList: filtered })
  },

  // 切换清单类型
  onSwitchType(e) {
    const listType = e.currentTarget.dataset.type
    if (listType === this.data.listType) return
    this.setData({ listType, searchKey: '' })
    this.loadList()
  },

  // 搜索
  onSearchChange(e) {
    this.setData({ searchKey: e.detail.value })
    this.applyFilter()
  },
  onSearch(e) {
    this.setData({ searchKey: e.detail.value })
    this.applyFilter()
  },

  // 重新加载（从后端热更新前端缓存）
  onReload() {
    wx.showLoading({ title: '重新加载...', mask: true })
    Promise.all([specialLists.reloadSpecialLists(), this.loadList()])
      .then(() => {
        wx.showToast({ title: '已同步最新清单', icon: 'success' })
      })
      .catch(err => {
        wx.showModal({ title: '重载失败', content: err.message || '未知错误', showCancel: false })
      })
      .then(() => wx.hideLoading())
  },

  // 添加
  onAdd() {
    this.setData({ showAddModal: true, newAnimalId: '' })
  },

  onNewAnimalIdInput(e) {
    this.setData({ newAnimalId: e.detail.value })
  },

  onCloseAddModal() {
    this.setData({ showAddModal: false, newAnimalId: '' })
  },

  onConfirmAdd() {
    const animalId = (this.data.newAnimalId || '').trim()
    if (!animalId) {
      wx.showToast({ title: '动物编号不能为空', icon: 'none' })
      return
    }
    if (!/^[A-Za-z0-9]{5,10}$/.test(animalId)) {
      wx.showToast({ title: '编号格式错误（5-10位字母数字）', icon: 'none' })
      return
    }

    // 获取操作者信息
    const operator = storage.getCurrentUser ? storage.getCurrentUser() : (getApp().globalData.currentUser || {})

    wx.showLoading({ title: '添加中...', mask: true })
    api.addToSpecialList(this.data.listType, animalId, operator)
      .then(res => {
        if (res.added) {
          // 重新加载（后端已热更新前端缓存）
          specialLists.reloadSpecialLists()
          wx.showToast({ title: '添加成功', icon: 'success' })
          this.setData({ showAddModal: false, newAnimalId: '' })
          this.loadList()
        } else {
          wx.showToast({ title: '该编号已存在', icon: 'none' })
        }
      })
      .catch(err => {
        wx.showModal({ title: '添加失败', content: err.message || '未知错误', showCancel: false })
      })
      .then(() => wx.hideLoading())
  },

  // 删除
  onDelete(e) {
    const animalId = e.currentTarget.dataset.id
    const listTypeName = this.data.listType === 'weak_monkey' ? '弱猴' : '剖腹产'
    wx.showModal({
      title: '删除确认',
      content: `确定要从${listTypeName}清单中删除「${animalId}」吗？`,
      confirmText: '确认删除',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        api.removeFromSpecialList(this.data.listType, animalId)
          .then(() => {
            specialLists.reloadSpecialLists()
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadList()
          })
          .catch(err => {
            wx.showModal({ title: '删除失败', content: err.message || '未知错误', showCancel: false })
          })
          .then(() => wx.hideLoading())
      }
    })
  }
})
