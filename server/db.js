/**
 * 数据库初始化与管理模块
 * 使用 better-sqlite3 创建 SQLite 数据库及表结构
 */

const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'obstetric.db')

let db = null

/**
 * 初始化数据库连接与表结构
 */
function initDB() {
  db = new Database(DB_PATH)

  // 启用 WAL 模式提升并发性能
  db.pragma('journal_mode = WAL')

  // 创建动物档案表
  db.exec(`
    CREATE TABLE IF NOT EXISTS animals (
      animalId TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT '未孕',
      latestBUltrasoundDate TEXT DEFAULT '',
      latestNonBUltrasoundDate TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)

  // 创建B超检查记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS b_records (
      id TEXT PRIMARY KEY,
      animalId TEXT NOT NULL,
      operationDate TEXT NOT NULL,
      pregnancyStatus TEXT NOT NULL,
      fetalStage TEXT DEFAULT '',
      gestationalSac TEXT DEFAULT '',
      crl TEXT DEFAULT '',
      bpd TEXT DEFAULT '',
      abdominalCircumference TEXT DEFAULT '',
      fetalHeartStrength TEXT DEFAULT '',
      fetalHeartValue TEXT DEFAULT '',
      fetalPosition TEXT DEFAULT '',
      placentaPosition TEXT DEFAULT '',
      amnioticFluid TEXT DEFAULT '',
      amnioticFluidPollution TEXT DEFAULT '',
      vetHighRisk TEXT DEFAULT '',
      birthCanalAbnormality TEXT DEFAULT '',
      uterineAbnormality TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      calculatedAge INTEGER DEFAULT NULL,
      standardAge INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT '可编辑',
      riskTags TEXT DEFAULT '[]',
      operator TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)

  // 创建非B超检查记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS non_b_records (
      id TEXT PRIMARY KEY,
      animalId TEXT NOT NULL,
      operationDate TEXT NOT NULL,
      examParts TEXT DEFAULT '[]',
      fetalPosition TEXT DEFAULT '',
      cervicalCheck TEXT DEFAULT '',
      vetHighRisk TEXT DEFAULT '',
      birthCanalAbnormality TEXT DEFAULT '',
      uterineAbnormality TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '可编辑',
      riskTags TEXT DEFAULT '[]',
      operator TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)

  // 创建妊娠结局记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS outcome_records (
      id TEXT PRIMARY KEY,
      animalId TEXT NOT NULL,
      outcomeDate TEXT NOT NULL,
      type TEXT NOT NULL,
      abnormalDescription TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      operator TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)

  // 创建审计日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      recordType TEXT NOT NULL,
      operation TEXT NOT NULL,
      operator TEXT DEFAULT '',
      operatorId TEXT DEFAULT '',
      operationTime TEXT NOT NULL,
      reason TEXT DEFAULT '',
      fieldChanges TEXT DEFAULT '[]',
      operationIP TEXT DEFAULT '0.0.0.0'
    )
  `)

  // 创建特殊动物清单表（弱猴 / 剖腹产）
  db.exec(`
    CREATE TABLE IF NOT EXISTS special_animal_lists (
      id TEXT PRIMARY KEY,
      animalId TEXT NOT NULL,
      listType TEXT NOT NULL,
      addedAt TEXT NOT NULL,
      addedBy TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      UNIQUE(animalId, listType)
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_b_records_animal ON b_records(animalId);
    CREATE INDEX IF NOT EXISTS idx_b_records_date ON b_records(animalId, operationDate);
    CREATE INDEX IF NOT EXISTS idx_non_b_records_animal ON non_b_records(animalId);
    CREATE INDEX IF NOT EXISTS idx_non_b_records_date ON non_b_records(animalId, operationDate);
    CREATE INDEX IF NOT EXISTS idx_outcome_records_animal ON outcome_records(animalId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(recordId);
    CREATE INDEX IF NOT EXISTS idx_special_animal_id ON special_animal_lists(animalId);
    CREATE INDEX IF NOT EXISTS idx_special_list_type ON special_animal_lists(listType);
  `)

  console.log('[DB] 数据库初始化完成，路径：' + DB_PATH)
  return db
}

/**
 * 获取数据库连接
 */
function getDB() {
  if (!db) {
    initDB()
  }
  return db
}

/**
 * 关闭数据库连接
 */
function closeDB() {
  if (db) {
    db.close()
    db = null
    console.log('[DB] 数据库连接已关闭')
  }
}

module.exports = { initDB, getDB, closeDB }
