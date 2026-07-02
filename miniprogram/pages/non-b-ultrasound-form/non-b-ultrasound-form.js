const storage = require('../../utils/storage.js')
const util = require('../../utils/util.js')

Page({
  data: {
    statusBarHeight: 20,
    mode: 'create',
    recordId: '',
    isLocked: false,
    isView: false,
    readOnly: false,

    form: {
      animalId: '',
      operationDate: '',
      examParts: [], // 检查部位（多选）：胎位/产道检查
      fetalPosition: '', // 胎位
      cervicalCheck: '', // 产道检查
      remark: ''
    },

    // 选项
    examPartOptions: ['胎位', '产道检查'],
    fetalPositionOptions: ['头位', '臀位', '斜位', '横位', '其他'],
    cervicalCheckOptions: ['＜1指', '1指', '2指', '3指'],

    // 动物编号模糊搜索
    animalList: [],
    filteredAnimalList: [],
    showAnimalDropdown: false,

    // 条件显示
    showFetalPosition: false,
    showCervicalCheck: false,

    // 修改原因
    showReasonModal: false,
    editReason: ''
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      'form.operationDate': util.today(),
      mode: options.mode || 'create',
      isView: options.mode === 'view',
      readOnly: options.mode === 'view'
    })

    // 加载动物列表（仅限已有动物）
    const animals = storage.getAllAnimals()
    this.setData({
      animalList: animals.map(a => a.animalId)
    })

    if (options.mode === 'edit' || options.mode === 'view') {
      this.loadRecord(options.id)
    }
  },

  loadRecord(id) {
    const record = storage.getNonBRecordById(id)
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'error' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const formData = { ...this.data.form }
    Object.keys(formData).forEach(key => {
      if (record[key] !== undefined) formData[key] = record[key]
    })

    const isLocked = record.status === '锁定'

    this.setData({
      form: formData,
      recordId: id,
      isLocked,
      readOnly: isLocked || this.data.isView,
      showFetalPosition: (formData.examParts || []).includes('胎位'),
      showCervicalCheck: (formData.examParts || []).includes('产道检查')
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
    if (this.data.readOnly) return
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

  // 日期
  onDateChange(e) {
    this.setData({ 'form.operationDate': e.detail.value })
  },

  // 检查部位多选
  onExamPartToggle(e) {
    if (this.data.readOnly) return
    const value = e.currentTarget.dataset.value
    let parts = [...this.data.form.examParts]
    const idx = parts.indexOf(value)
    if (idx >= 0) {
      parts.splice(idx, 1)
    } else {
      parts.push(value)
    }
    this.setData({
      'form.examParts': parts,
      showFetalPosition: parts.includes('胎位'),
      showCervicalCheck: parts.includes('产道检查')
    })
  },

  onFetalPositionTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.fetalPosition': e.currentTarget.dataset.value })
  },

  onCervicalCheckTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.cervicalCheck': e.currentTarget.dataset.value })
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value })
  },

  validateForm() {
    const f = this.data.form
    const errors = []

    // 动物编号：格式校验
    const idCheck = this.validateAnimalIdFormat(f.animalId)
    if (!idCheck.valid) {
      wx.showToast({ title: idCheck.msg, icon: 'none', duration: 2500 })
      return null
    }
    if (!f.operationDate) errors.push('操作日期')
    if (!f.examParts || f.examParts.length === 0) errors.push('检查部位')
    if (f.examParts && f.examParts.includes('胎位') && !f.fetalPosition) errors.push('胎位')
    if (f.examParts && f.examParts.includes('产道检查') && !f.cervicalCheck) errors.push('产道检查')

    return errors
  },

  onSubmit() {
    const errors = this.validateForm()
    if (errors === null) return
    if (errors.length > 0) {
      const msg = `请填写：${errors.join('、')}`
      if (msg.length > 20) {
        wx.showModal({ title: '表单校验失败', content: msg, showCancel: false })
      } else {
        wx.showToast({ title: msg, icon: 'none', duration: 2500 })
      }
      return
    }

    // 校验当前登录用户
    const currentUser = storage.getCurrentUser ? storage.getCurrentUser() : null
    if (!currentUser) {
      wx.showModal({
        title: '无法提交',
        content: '未能获取当前登录用户信息，请重新进入小程序后再试。',
        showCancel: false
      })
      return
    }

    const f = this.data.form
    const submitData = {
      animalId: f.animalId,
      operationDate: f.operationDate,
      examParts: f.examParts,
      fetalPosition: f.fetalPosition,
      cervicalCheck: f.cervicalCheck,
      remark: f.remark || ''
    }

    if (this.data.mode === 'create') {
      wx.showLoading({ title: '提交中...' })
      storage.createNonBRecord(submitData).then(() => {
        wx.hideLoading()
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      }).catch(err => {
        wx.hideLoading()
        wx.showModal({ title: '提交失败', content: err.message || '未知错误', showCancel: false })
      })
    } else if (this.data.mode === 'edit') {
      this.setData({ showReasonModal: true, editReason: '' })
    }
  },

  onReasonInput(e) {
    this.setData({ editReason: e.detail.value })
  },

  onReasonConfirm() {
    if (!this.data.editReason.trim()) {
      wx.showToast({ title: '请填写修改原因', icon: 'none' })
      return
    }

    const f = this.data.form
    const submitData = {
      animalId: f.animalId,
      operationDate: f.operationDate,
      examParts: f.examParts,
      fetalPosition: f.fetalPosition,
      cervicalCheck: f.cervicalCheck,
      remark: f.remark || ''
    }

    try {
      storage.updateNonBRecord(this.data.recordId, submitData, this.data.editReason)
      wx.showToast({ title: '修改成功', icon: 'success' })
      this.setData({ showReasonModal: false })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      wx.showModal({ title: '提交失败', content: err.message || '未知错误', showCancel: false })
    }
  },

  onReasonCancel() {
    this.setData({ showReasonModal: false })
  },

  onBack() {
    wx.navigateBack()
  }
})
