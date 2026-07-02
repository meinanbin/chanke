const storage = require('../../utils/storage.js')
const ga = require('../../utils/gestational-age.js')
const util = require('../../utils/util.js')

Page({
  data: {
    statusBarHeight: 20,
    mode: 'create', // create / edit / view
    recordId: '',
    isLocked: false,
    isView: false,
    readOnly: false,

    // 表单数据
    form: {
      animalId: '',
      operationDate: '',
      pregnancyStatus: '', // 未孕 / 疑似怀孕 / 在孕
      calculatedAge: null, // 计算胎龄（只读，自动计算）
      standardAge: null, // 标准胎龄（只读，自动计算）
      fetalStage: '', // 胎儿阶段：胚种期/胚胎期/胎儿期
      gestationalSac: '', // 孕囊（胚种期）
      crl: '', // 长径/顶臀径（胚胎期）
      bpd: '', // 双顶径（胎儿期）
      abdominalCircumference: '', // 腹围（胎儿期）
      fetalHeartStrength: '', // 胎心强度
      fetalHeartValue: '', // 胎心数值
      placentaMaturity: '', // 胎盘成熟度（胎儿期）
      placentaPosition: [], // 胎盘位置（胎儿期，多选）
      fetalPosition: '', // 胎位（胎儿期且双顶径≥4）
      amnioticFluid: '', // 羊水量
      amnioticFluidPollution: '', // 羊水污染
      cervicalDilation: '', // 宫颈扩张
      birthCanalAbnormality: '', // 产道异常
      uterineAbnormality: '', // 子宫异常
      vetHighRisk: '', // 兽医认定高危
      remark: '' // 备注
    },

    // 选项
    pregnancyStatusOptions: ['未孕', '疑似怀孕', '在孕'],
    fetalStageOptions: ['胚种期', '胚胎期', '胎儿期'],
    heartStrengthOptions: ['强', '有', '弱', '无'],
    placentaMaturityOptions: ['0级', '1级', '2级', '3级'],
    placentaPositionOptions: ['未测', '完全前置', '部分前置', '左宫体', '右宫体', '宫底'],
    fetalPositionOptions: ['头位', '臀位', '斜位', '横位', '其他'],
    amnioticFluidOptions: ['正常', '未测', '过多', '过少', '无'],
    amnioticPollutionOptions: ['无回声', '细密均匀弱回声', '粗颗粒浑浊强回声'],
    cervicalDilationOptions: ['未扩张', '半指', '1指', '1.5指', '2指', '2指以上'],

    // 条件显示
    showPregnantFields: false,
    showGestationalSac: false,
    showCRL: false,
    showFetalFields: false,
    showFetalPosition: false,

    // 修改原因弹窗
    showReasonModal: false,
    editReason: '',

    // 胎盘位置选中状态Map（用于WXML中判断标签高亮，避免indexOf不支持的问题）
    placentaPositionSelectedMap: {},

    // 日期picker
    showDatePicker: false,
    datePickerValue: ''
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    const today = util.today()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      'form.operationDate': today,
      datePickerValue: today,
      mode: options.mode || 'create',
      isView: options.mode === 'view',
      readOnly: options.mode === 'view'
    })

    if (options.mode === 'edit' || options.mode === 'view') {
      this.loadRecord(options.id)
    }
  },

  loadRecord(id) {
    const record = storage.getBRecordById(id)
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'error' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const formData = { ...this.data.form }
    Object.keys(formData).forEach(key => {
      if (record[key] !== undefined) {
        formData[key] = record[key]
      }
    })

    // 确保 placentaPosition 是数组（防御性处理）
    if (formData.placentaPosition && !Array.isArray(formData.placentaPosition)) {
      // 如果是字符串，转为单元素数组
      formData.placentaPosition = [formData.placentaPosition]
    }
    if (!formData.placentaPosition) {
      formData.placentaPosition = []
    }

    const isLocked = record.status === '锁定'
    this.setData({
      form: formData,
      recordId: id,
      isLocked,
      readOnly: isLocked || this.data.isView,
      datePickerValue: formData.operationDate
    })

    this.updateConditionalDisplay()
    // 同步胎盘位置选中状态Map
    this.syncPlacentaPositionMap()
  },

  // 更新条件显示
  updateConditionalDisplay() {
    const f = this.data.form
    const isPregnant = f.pregnancyStatus === '在孕'
    const stage = f.fetalStage
    const bpdVal = parseFloat(f.bpd)

    this.setData({
      showPregnantFields: isPregnant,
      showGestationalSac: isPregnant && stage === '胚种期',
      showCRL: isPregnant && stage === '胚胎期',
      showFetalFields: isPregnant && stage === '胎儿期',
      showFetalPosition: isPregnant && stage === '胎儿期' && !isNaN(bpdVal) && bpdVal >= 4
    })
  },

  // 重新计算胎龄
  recalculateAge() {
    const f = this.data.form
    if (f.pregnancyStatus !== '在孕') return

    let measurement = null
    if (f.fetalStage === '胚种期') {
      measurement = null // 固定20
    } else if (f.fetalStage === '胚胎期') {
      measurement = f.crl
    } else if (f.fetalStage === '胎儿期') {
      measurement = f.bpd
    }

    const calcAge = ga.calcGestationalAge(f.fetalStage, measurement)

    if (calcAge !== null) {
      // 计算标准胎龄
      const historyRecords = storage.getBRecordsByAnimal(f.animalId)
      // 排除当前编辑的记录
      const filteredHistory = this.data.recordId
        ? historyRecords.filter(r => r.id !== this.data.recordId)
        : historyRecords
      const stdAge = ga.calcStandardAge(f.animalId, f.operationDate, calcAge, filteredHistory)

      this.setData({
        'form.calculatedAge': calcAge,
        'form.standardAge': stdAge
      })
    }
  },

  // ===== 输入事件 =====

  onAnimalIdInput(e) {
    this.setData({ 'form.animalId': e.detail.value })
  },

  onDateChange(e) {
    this.setData({
      'form.operationDate': e.detail.value,
      datePickerValue: e.detail.value
    })
    this.recalculateAge()
  },

  onPregnancyStatusTap(e) {
    if (this.data.readOnly) return
    const value = e.currentTarget.dataset.value
    this.setData({ 'form.pregnancyStatus': value })
    // 切换为非"在孕"状态时清空在孕相关字段
    if (value !== '在孕') {
      this.setData({
        'form.fetalStage': '',
        'form.calculatedAge': null,
        'form.standardAge': null,
        'form.gestationalSac': '',
        'form.crl': '',
        'form.bpd': '',
        'form.abdominalCircumference': '',
        'form.fetalHeartStrength': '',
        'form.fetalHeartValue': '',
        'form.placentaMaturity': '',
        'form.placentaPosition': [],
        'form.fetalPosition': '',
        'form.amnioticFluid': '',
        'form.amnioticFluidPollution': '',
        'form.cervicalDilation': '',
        placentaPositionSelectedMap: {}
      })
    }
    this.updateConditionalDisplay()
  },

  onFetalStageTap(e) {
    if (this.data.readOnly) return
    const value = e.currentTarget.dataset.value
    this.setData({
      'form.fetalStage': value,
      // 切换阶段时清空测量值
      'form.gestationalSac': '',
      'form.crl': '',
      'form.bpd': '',
      'form.abdominalCircumference': '',
      'form.placentaMaturity': '',
      'form.placentaPosition': [],
      'form.fetalPosition': '',
      'form.calculatedAge': null,
      'form.standardAge': null,
      placentaPositionSelectedMap: {}
    })
    this.updateConditionalDisplay()
    this.recalculateAge()
  },

  onGestationalSacInput(e) {
    this.setData({ 'form.gestationalSac': e.detail.value })
  },

  onCRLInput(e) {
    this.setData({ 'form.crl': e.detail.value })
    this.recalculateAge()
  },

  onBPDInput(e) {
    this.setData({ 'form.bpd': e.detail.value })
    this.recalculateAge()
    this.updateConditionalDisplay()
  },

  onAbdominalCircumferenceInput(e) {
    this.setData({ 'form.abdominalCircumference': e.detail.value })
  },

  onHeartStrengthTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.fetalHeartStrength': e.currentTarget.dataset.value })
  },

  onHeartValueInput(e) {
    this.setData({ 'form.fetalHeartValue': e.detail.value })
  },

  onPlacentaMaturityTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.placentaMaturity': e.currentTarget.dataset.value })
  },

  // 胎盘位置多选（内联标签切换）
  onPlacentaPositionToggle(e) {
    if (this.data.readOnly) return
    const value = e.currentTarget.dataset.value
    let positions = [...this.data.form.placentaPosition]
    const idx = positions.indexOf(value)
    if (idx >= 0) {
      positions.splice(idx, 1)
    } else {
      positions.push(value)
    }
    // 同步更新选中状态Map（WXML不支持indexOf，用Map判断高亮）
    const selectedMap = {}
    positions.forEach(val => { selectedMap[val] = true })
    this.setData({
      'form.placentaPosition': positions,
      placentaPositionSelectedMap: selectedMap
    })
  },

  // 根据form.placentaPosition同步更新选中状态Map
  syncPlacentaPositionMap() {
    const selectedMap = {}
    ;(this.data.form.placentaPosition || []).forEach(val => { selectedMap[val] = true })
    this.setData({ placentaPositionSelectedMap: selectedMap })
  },

  onFetalPositionTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.fetalPosition': e.currentTarget.dataset.value })
  },

  onAmnioticFluidTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.amnioticFluid': e.currentTarget.dataset.value })
  },

  onAmnioticPollutionTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.amnioticFluidPollution': e.currentTarget.dataset.value })
  },

  onCervicalDilationTap(e) {
    if (this.data.readOnly) return
    this.setData({ 'form.cervicalDilation': e.currentTarget.dataset.value })
  },

  onTextInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  // ===== 字段格式与范围校验 =====

  // 校验动物编号：5-8位，仅允许大写字母(A-Z)和数字(0-9)
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

  // 校验数字范围，val 为空时跳过（非必填）
  validateNumberRange(val, min, max, fieldName) {
    if (val === '' || val === undefined || val === null) return { valid: true }
    const num = parseFloat(val)
    if (isNaN(num)) {
      return { valid: false, msg: `${fieldName}必须为数字` }
    }
    if (num < min || num > max) {
      return { valid: false, msg: `${fieldName}必须为${min}-${max}内的数字` }
    }
    return { valid: true }
  },

  // 失焦即时校验
  onAnimalIdBlur() {
    const r = this.validateAnimalIdFormat(this.data.form.animalId)
    if (!r.valid && this.data.form.animalId) {
      wx.showToast({ title: r.msg, icon: 'none', duration: 2500 })
    }
  },

  onGestationalSacBlur() {
    const r = this.validateNumberRange(this.data.form.gestationalSac, 0, 3, '孕囊')
    if (!r.valid && this.data.form.gestationalSac) {
      wx.showToast({ title: r.msg, icon: 'none', duration: 2500 })
    }
  },

  onCRLBlur() {
    const r = this.validateNumberRange(this.data.form.crl, 0, 5, '长径/顶臀径')
    if (!r.valid && this.data.form.crl) {
      wx.showToast({ title: r.msg, icon: 'none', duration: 2500 })
    }
  },

  onBPDBlur() {
    const r = this.validateNumberRange(this.data.form.bpd, 0, 5.5, '双顶径')
    if (!r.valid && this.data.form.bpd) {
      wx.showToast({ title: r.msg, icon: 'none', duration: 2500 })
    }
  },

  onAbdominalCircumferenceBlur() {
    const r = this.validateNumberRange(this.data.form.abdominalCircumference, 0, 20, '腹围')
    if (!r.valid && this.data.form.abdominalCircumference) {
      wx.showToast({ title: r.msg, icon: 'none', duration: 2500 })
    }
  },

  onHeartValueBlur() {
    const r = this.validateNumberRange(this.data.form.fetalHeartValue, 0, 300, '胎心数值')
    if (!r.valid && this.data.form.fetalHeartValue) {
      wx.showToast({ title: r.msg, icon: 'none', duration: 2500 })
    }
  },

  // ===== 表单校验与提交 =====

  validateForm() {
    const f = this.data.form

    // 动物编号：格式+长度校验
    const idCheck = this.validateAnimalIdFormat(f.animalId)
    if (!idCheck.valid) {
      wx.showToast({ title: idCheck.msg, icon: 'none', duration: 2500 })
      return null
    }

    const errors = []

    // 操作日期
    if (!f.operationDate) errors.push('实际操作日期')

    // 妊娠状态
    if (!f.pregnancyStatus) errors.push('妊娠状态')

    // 在孕时的校验
    if (f.pregnancyStatus === '在孕') {
      if (!f.fetalStage) errors.push('胎儿阶段')

      // 胚种期：孕囊范围校验（非必填）
      if (f.fetalStage === '胚种期' && f.gestationalSac) {
        const sacCheck = this.validateNumberRange(f.gestationalSac, 0, 3, '孕囊')
        if (!sacCheck.valid) {
          wx.showToast({ title: sacCheck.msg, icon: 'none', duration: 2500 })
          return null
        }
      }

      // 胚胎期：长径/顶臀径必填+范围校验
      if (f.fetalStage === '胚胎期') {
        if (!f.crl) errors.push('长径/顶臀径')
        if (f.crl) {
          const crlCheck = this.validateNumberRange(f.crl, 0, 5, '长径/顶臀径')
          if (!crlCheck.valid) {
            wx.showToast({ title: crlCheck.msg, icon: 'none', duration: 2500 })
            return null
          }
        }
      }

      // 胎儿期：双顶径、腹围必填+范围校验
      if (f.fetalStage === '胎儿期') {
        if (!f.bpd) errors.push('双顶径')
        if (f.bpd) {
          const bpdCheck = this.validateNumberRange(f.bpd, 0, 5.5, '双顶径')
          if (!bpdCheck.valid) {
            wx.showToast({ title: bpdCheck.msg, icon: 'none', duration: 2500 })
            return null
          }
        }

        // 腹围：非必填，有值时做范围校验
        if (f.abdominalCircumference) {
          const acCheck = this.validateNumberRange(f.abdominalCircumference, 0, 20, '腹围')
          if (!acCheck.valid) {
            wx.showToast({ title: acCheck.msg, icon: 'none', duration: 2500 })
            return null
          }
        }

        if (!f.placentaMaturity) errors.push('胎盘成熟度')
        if (f.placentaPosition.length === 0) errors.push('胎盘位置')

        const bpdVal = parseFloat(f.bpd)
        if (!isNaN(bpdVal) && bpdVal >= 4 && !f.fetalPosition) errors.push('胎位')
      }
    }

    // 胎心数值：范围校验（非必填，有值时校验）
    if (f.fetalHeartValue) {
      const hvCheck = this.validateNumberRange(f.fetalHeartValue, 0, 300, '胎心数值')
      if (!hvCheck.valid) {
        wx.showToast({ title: hvCheck.msg, icon: 'none', duration: 2500 })
        return null
      }
    }

    if (errors.length > 0) {
      return errors
    }
    return []
  },

  onSubmit() {
    const errors = this.validateForm()
    if (errors === null) return // 已弹出特定提示
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
    // 准备提交数据
    const submitData = {
      animalId: f.animalId,
      operationDate: f.operationDate,
      pregnancyStatus: f.pregnancyStatus,
      calculatedAge: f.calculatedAge,
      standardAge: f.standardAge,
      fetalStage: f.fetalStage,
      gestationalSac: f.gestationalSac ?? '',
      crl: f.crl ?? '',
      bpd: f.bpd ?? '',
      abdominalCircumference: f.abdominalCircumference ?? '',
      fetalHeartStrength: f.fetalHeartStrength ?? '',
      fetalHeartValue: f.fetalHeartValue ?? '',
      placentaMaturity: f.placentaMaturity || '',
      placentaPosition: f.placentaPosition,
      fetalPosition: f.fetalPosition || '',
      amnioticFluid: f.amnioticFluid || '',
      amnioticFluidPollution: f.amnioticFluidPollution || '',
      cervicalDilation: f.cervicalDilation || '',
      birthCanalAbnormality: f.birthCanalAbnormality || '',
      uterineAbnormality: f.uterineAbnormality || '',
      vetHighRisk: f.vetHighRisk || '',
      remark: f.remark || ''
    }

    if (this.data.mode === 'create') {
      // 新建（异步调用远程API）
      wx.showLoading({ title: '提交中...' })
      storage.createBRecord(submitData).then(() => {
        wx.hideLoading()
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      }).catch(err => {
        wx.hideLoading()
        wx.showModal({ title: '提交失败', content: err.message || '未知错误', showCancel: false })
      })
    } else if (this.data.mode === 'edit') {
      // 编辑 → 弹出修改原因
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
      pregnancyStatus: f.pregnancyStatus,
      calculatedAge: f.calculatedAge,
      standardAge: f.standardAge,
      fetalStage: f.fetalStage,
      gestationalSac: f.gestationalSac ?? '',
      crl: f.crl ?? '',
      bpd: f.bpd ?? '',
      abdominalCircumference: f.abdominalCircumference ?? '',
      fetalHeartStrength: f.fetalHeartStrength ?? '',
      fetalHeartValue: f.fetalHeartValue ?? '',
      placentaMaturity: f.placentaMaturity || '',
      placentaPosition: f.placentaPosition,
      fetalPosition: f.fetalPosition || '',
      amnioticFluid: f.amnioticFluid || '',
      amnioticFluidPollution: f.amnioticFluidPollution || '',
      cervicalDilation: f.cervicalDilation || '',
      birthCanalAbnormality: f.birthCanalAbnormality || '',
      uterineAbnormality: f.uterineAbnormality || '',
      vetHighRisk: f.vetHighRisk || '',
      remark: f.remark || ''
    }

    wx.showLoading({ title: '提交中...' })
    storage.updateBRecord(this.data.recordId, submitData, this.data.editReason).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '修改成功', icon: 'success' })
      this.setData({ showReasonModal: false })
      setTimeout(() => wx.navigateBack(), 1500)
    }).catch(err => {
      wx.hideLoading()
      wx.showModal({ title: '提交失败', content: err.message || '未知错误', showCancel: false })
    })
  },

  onReasonCancel() {
    this.setData({ showReasonModal: false })
  },

  // 返回
  onBack() {
    wx.navigateBack()
  }
})
