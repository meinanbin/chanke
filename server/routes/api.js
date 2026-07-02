/**
 * API 路由模块
 * 定义所有 RESTful 接口
 */

const express = require('express')
const service = require('../service.js')
const specialLists = require('../special-lists.js')

const router = express.Router()

// ========== 动物档案 ==========

// 获取所有动物
router.get('/animals', (req, res) => {
  try {
    const animals = service.getAllAnimals()
    res.json({ success: true, data: animals })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 获取单个动物
router.get('/animals/:animalId', (req, res) => {
  try {
    const animal = service.getAnimalById(req.params.animalId)
    if (!animal) return res.json({ success: false, error: '动物档案不存在' })
    res.json({ success: true, data: animal })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 创建/更新动物档案
router.post('/animals', (req, res) => {
  try {
    const { animalId, ...data } = req.body
    if (!animalId) return res.json({ success: false, error: '动物编号不能为空' })
    const animal = service.upsertAnimal(animalId, data)
    res.json({ success: true, data: animal })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 更新动物状态
router.patch('/animals/:animalId/status', (req, res) => {
  try {
    const { status } = req.body
    if (!status) return res.json({ success: false, error: '状态不能为空' })
    service.updateAnimalStatus(req.params.animalId, status)
    const animal = service.getAnimalById(req.params.animalId)
    res.json({ success: true, data: animal })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== B超检查 ==========

// 获取指定动物的B超记录（正序）
router.get('/b-records/animal/:animalId', (req, res) => {
  try {
    const order = req.query.order || 'asc'
    const records = order === 'desc'
      ? service.getBRecordsByAnimalDesc(req.params.animalId)
      : service.getBRecordsByAnimal(req.params.animalId)
    res.json({ success: true, data: records })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 获取单条B超记录
router.get('/b-records/:id', (req, res) => {
  try {
    const record = service.getBRecordById(req.params.id)
    if (!record) return res.json({ success: false, error: '记录不存在' })
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 创建B超记录
router.post('/b-records', (req, res) => {
  try {
    const record = service.createBRecord(req.body, req.body.operator || {})
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 更新B超记录
router.put('/b-records/:id', (req, res) => {
  try {
    const { reason, operator, ...data } = req.body
    const record = service.updateBRecord(req.params.id, data, reason, operator || {})
    if (!record) return res.json({ success: false, error: '记录不存在' })
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== 非B超检查 ==========

router.get('/non-b-records/animal/:animalId', (req, res) => {
  try {
    const order = req.query.order || 'asc'
    const records = order === 'desc'
      ? service.getNonBRecordsByAnimalDesc(req.params.animalId)
      : service.getNonBRecordsByAnimal(req.params.animalId)
    res.json({ success: true, data: records })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

router.get('/non-b-records/:id', (req, res) => {
  try {
    const record = service.getNonBRecordById(req.params.id)
    if (!record) return res.json({ success: false, error: '记录不存在' })
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

router.post('/non-b-records', (req, res) => {
  try {
    const record = service.createNonBRecord(req.body, req.body.operator || {})
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

router.put('/non-b-records/:id', (req, res) => {
  try {
    const { reason, operator, ...data } = req.body
    const record = service.updateNonBRecord(req.params.id, data, reason, operator || {})
    if (!record) return res.json({ success: false, error: '记录不存在' })
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== 妊娠结局 ==========

router.get('/outcome-records/animal/:animalId', (req, res) => {
  try {
    const records = service.getOutcomeRecordsByAnimalDesc(req.params.animalId)
    res.json({ success: true, data: records })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

router.post('/outcome-records', (req, res) => {
  try {
    const record = service.createOutcomeRecord(req.body, req.body.operator || {})
    res.json({ success: true, data: record })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== 删除 ==========

// 删除动物所有记录
router.delete('/animals/:animalId/all-records', (req, res) => {
  try {
    const operator = req.body.operator || {}
    service.deleteAnimalAllRecords(req.params.animalId, operator)
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== 汇总 ==========

router.get('/summary', (req, res) => {
  try {
    const list = service.getSummaryList()
    res.json({ success: true, data: list })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== 审计日志 ==========

router.get('/audit-logs', (req, res) => {
  try {
    const recordId = req.query.recordId || null
    const logs = service.getAuditLogs(recordId)
    res.json({ success: true, data: logs })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ========== 特殊动物清单（弱猴/剖腹产） ==========

// 获取清单记录（可按 listType 过滤）
router.get('/special-lists', (req, res) => {
  try {
    const listType = req.query.listType || null
    if (listType && listType !== 'weak_monkey' && listType !== 'cesarean') {
      return res.json({ success: false, error: 'listType 参数错误' })
    }
    if (listType) {
      const records = specialLists.getListRecords(listType)
      return res.json({ success: true, data: records })
    }
    const weakRecords = specialLists.getListRecords('weak_monkey')
    const cesareanRecords = specialLists.getListRecords('cesarean')
    res.json({
      success: true,
      data: { weak_monkey: weakRecords, cesarean: cesareanRecords }
    })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 添加动物到清单
router.post('/special-lists', (req, res) => {
  try {
    const { listType, animalId, operator } = req.body
    if (!listType || !animalId) {
      return res.json({ success: false, error: 'listType 与 animalId 不能为空' })
    }
    if (listType !== 'weak_monkey' && listType !== 'cesarean') {
      return res.json({ success: false, error: 'listType 取值必须为 weak_monkey 或 cesarean' })
    }
    const added = specialLists.addToList(listType, animalId, operator || {})
    res.json({ success: true, data: { added } })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 从清单中删除动物
router.delete('/special-lists/:listType/:animalId', (req, res) => {
  try {
    const { listType, animalId } = req.params
    if (listType !== 'weak_monkey' && listType !== 'cesarean') {
      return res.json({ success: false, error: 'listType 参数错误' })
    }
    const removed = specialLists.removeFromList(listType, animalId)
    res.json({ success: true, data: { removed } })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

module.exports = router
