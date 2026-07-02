const storage = require('../../utils/storage.js')
const util = require('../../utils/util.js')

Page({
  data: {
    statusBarHeight: 20,
    mode: 'create',

    form: {
      animalId: '',
      outcomeDate: '',
      type: '', // 转DPM登记/正常/早产/死胎/难产/流产/未孕/其他
      abnormalDescription: '', // 非正常登记说明
      remark: ''
    },

    typeOptions: ['转DPM登记', '正常', '早产', '死胎', '难产', '流产', '未孕', '其他'],

    animalList: [],
    filteredAnimalList: [],
    showAnimalDropdown: false,

    showAbnormalDesc: false
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      'form.outcomeDate': util.today(),
      mode: options.mode || 'create'
    })

    const animals = storage.getAllAnimals()
    this.setData({
      animalList: animals.map(a => a.animalId)
    })
  },

  // 动物编号：输入触发模糊搜索（自动转大写）
  onAnimalInput(e) {
    const value = (e.detail.value || '').toUpperCase()
    this.setData({ 'form.animalId': value })
    this.filterAnimalList(value)
  },

  // 聚焦时展示全部动物
  onAnimalFocus() {
    this.filterAnimalList(this.data.form.animalId)
  },

  // 模糊过滤
  filterAnimalList(keyword) {
    const list = this.data.animalList
    let filtered = list
    if (keyword) {
      filtered = list.filter(id => id.indexOf(keyword) !== -1)
    }
    this.setData({
      filteredAnimalList: filtered,
      showAnimalDropdown: true
    })
  },

  // 从下拉列表选择
  onAnimalDropdownSelect(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'form.animalId': value,
      showAnimalDropdown: false
    })
  },

  // 关闭下拉
  onAnimalDropdownClose() {
    this.setData({ showAnimalDropdown: false })
  },

  // 校验动物编号格式：5-8位，仅大写字母+数字
  validateAnimalIdFormat(animalId) {
    if (!animalId) return { valid: false, msg: '请填写动物编号' }
    if (animalId.length < 5 || animalId.length > 8) {
      return { valid: false, msg: '动物编号必须为5-8位数字和字母组合' }
    }
    if (!/^[A-Z0-9]+$/.test(animalId)) {
      return { valid: false, msg: '动物编号必须为5-8位数字和字母组合' }
    }
    return { valid: true }
  },

  onDateChange(e) {
    this.setData({ 'form.outcomeDate': e.detail.value })
  },

  onTypeTap(e) {
    const value = e.currentTarget.dataset.value
    const showAbnormalDesc = value !== '转DPM登记'
    this.setData({
      'form.type': value,
      showAbnormalDesc: showAbnormalDesc
    })
    // 切换为转DPM登记时清空说明内容
    if (!showAbnormalDesc) {
      this.setData({ 'form.abnormalDescription': '' })
    }
  },

  onAbnormalDescInput(e) {
    this.setData({ 'form.abnormalDescription': e.detail.value })
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value })
  },

  validateForm() {
    const f = this.data.form

    // 动物编号：格式校验
    const idCheck = this.validateAnimalIdFormat(f.animalId)
    if (!idCheck.valid) {
      wx.showToast({ title: idCheck.msg, icon: 'none', duration: 2500 })
      return null
    }

    const errors = []
    if (!f.outcomeDate) errors.push('结局日期')
    if (!f.type) errors.push('类型')
    // 非正常登记说明：类型非"转DPM登记"时显示且必填
    if (f.type && f.type !== '转DPM登记' && !f.abnormalDescription) {
      errors.push('非正常登记说明')
    }

    return errors
  },

  onSubmit() {
    const errors = this.validateForm()
    if (errors === null) return
    if (errors.length > 0) {
      wx.showToast({ title: `请填写: ${errors.join('、')}`, icon: 'none', duration: 2500 })
      return
    }

    // 确认提交（提示将触发数据锁定）
    wx.showModal({
      title: '确认登记',
      content: '提交后将自动锁定该动物在结局日期前的所有B超及非B超记录，且不可撤销。确认提交？',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          this.doSubmit()
        }
      }
    })
  },

  doSubmit() {
    // 校验当前登录用户
    const currentUser = storage.getCurrentUser ? storage.getCurrentUser() : null
    if (!currentUser) {
      wx.showModal({
        title: '无法提交',
        content: '未能获取当前登录用户信息，请重新进入小程序后再试。',
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#4A90D9'
      })
      return
    }

    const f = this.data.form
    const submitData = {
      animalId: f.animalId,
      outcomeDate: f.outcomeDate,
      type: f.type,
      abnormalDescription: f.abnormalDescription || '',
      remark: f.remark || ''
    }

    wx.showLoading({ title: '提交中...' })
    storage.createOutcomeRecord(submitData).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '登记成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    }).catch(err => {
      wx.hideLoading()
      wx.showModal({
        title: '无法提交',
        content: err.message || '操作失败',
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#4A90D9'
      })
    })
  },

  onBack() {
    wx.navigateBack()
  }
})
