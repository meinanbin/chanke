/**
 * 产科检查管理小程序 - 后端服务器
 * Express + SQLite，提供 RESTful API
 */

const express = require('express')
const cors = require('cors')
const { initDB, closeDB } = require('./db.js')
const specialLists = require('./special-lists.js')
const apiRoutes = require('./routes/api.js')

const app = express()
const PORT = 3000

// 中间件
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// API 路由
app.use('/api', apiRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 初始化数据库
initDB()

// 初始化特殊清单缓存
specialLists.initSpecialLists()

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`[Server] 产科检查管理后端服务已启动`)
  console.log(`[Server] 端口：${PORT}`)
  console.log(`[Server] API 地址：http://localhost:${PORT}/api`)
  console.log(`[Server] 健康检查：http://localhost:${PORT}/health`)
})

// 优雅退出
process.on('SIGINT', () => {
  console.log('[Server] 收到 SIGINT，正在关闭...')
  closeDB()
  server.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[Server] 收到 SIGTERM，正在关闭...')
  closeDB()
  server.close()
  process.exit(0)
})
