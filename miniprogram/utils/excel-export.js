/**
 * Excel导出工具模块
 * 生成xls格式文件（HTML表格方式，Excel可直接打开）
 * 使用微信文件系统API写入临时文件，再通过wx.openDocument打开
 */

const util = require('./util.js')

/**
 * 生成Excel XML（HTML表格格式）
 * @param {string} sheetName 工作表名称
 * @param {Array<string>} headers 表头
 * @param {Array<Array>} rows 数据行
 * @returns {string} xls文件内容
 */
function buildXlsContent(sheetName, headers, rows) {
  const esc = (val) => {
    if (val === null || val === undefined) return ''
    let s = String(val)
    s = s.replace(/&/g, '&amp;')
    s = s.replace(/</g, '&lt;')
    s = s.replace(/>/g, '&gt;')
    s = s.replace(/"/g, '&quot;')
    return s
  }

  let html = ''
  html += '<html xmlns:o="urn:schemas-microsoft-com:office:office"'
  html += ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
  html += ' xmlns="http://www.w3.org/TR/REC-html40">'
  html += '<head>'
  html += '<meta charset="UTF-8">'
  html += '<!--[if gte mso 9]><xml>'
  html += '<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>'
  html += '<x:Name>' + esc(sheetName) + '</x:Name>'
  html += '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>'
  html += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>'
  html += '</xml><![endif]-->'
  html += '<style>td{font-family:微软雅黑;font-size:11pt;border:1px solid #ccc;}'
  html += 'th{font-family:微软雅黑;font-size:11pt;border:1px solid #ccc;background:#d9e2f3;font-weight:bold;}</style>'
  html += '</head><body><table border="1">'

  // 表头
  html += '<tr>'
  headers.forEach(h => {
    html += '<th>' + esc(h) + '</th>'
  })
  html += '</tr>'

  // 数据行
  rows.forEach(row => {
    html += '<tr>'
    headers.forEach((_, i) => {
      html += '<td>' + esc(row[i]) + '</td>'
    })
    html += '</tr>'
  })

  html += '</table></body></html>'
  return html
}

/**
 * 导出数据为xls文件并打开
 * @param {string} filename 文件名（不含扩展名）
 * @param {string} sheetName 工作表名
 * @param {Array<string>} headers 表头
 * @param {Array<Array>} rows 数据行
 */
function exportToXls(filename, sheetName, headers, rows) {
  if (!rows || rows.length === 0) {
    wx.showToast({ title: '暂无数据可导出', icon: 'none' })
    return
  }

  wx.showLoading({ title: '正在生成文件...' })

  const content = buildXlsContent(sheetName, headers, rows)
  const fs = wx.getFileSystemManager()
  const filePath = `${wx.env.USER_DATA_PATH}/${filename}_${util.today()}.xls`

  fs.writeFile({
    filePath,
    data: content,
    encoding: 'utf8',
    success: () => {
      wx.hideLoading()
      wx.openDocument({
        filePath,
        fileType: 'xls',
        showMenu: true,
        success: () => {
          // 文件已打开，用户可通过右上角菜单转发或保存
        },
        fail: () => {
          // openDocument失败时尝试直接预览
          wx.showToast({ title: '文件已生成，可通过文件管理查看', icon: 'none', duration: 2500 })
        }
      })
    },
    fail: (err) => {
      wx.hideLoading()
      wx.showToast({ title: '文件生成失败', icon: 'error' })
    }
  })
}

/**
 * 导出产科检查汇总数据
 */
function exportSummary(list) {
  const headers = [
    '动物编号', '状态', '最新B超日期', '最新非B超日期',
    'B超检查次数', '非B超检查次数', '妊娠结局次数'
  ]
  const rows = list.map(item => [
    item.animalId || '',
    item.status || '',
    item.latestBUltrasoundDate || '',
    item.latestNonBUltrasoundDate || '',
    item.bRecordCount || 0,
    item.nonBRecordCount || 0,
    item.outcomeCount || 0
  ])
  exportToXls('产科检查汇总', '产科检查汇总', headers, rows)
}

/**
 * 导出B超检查数据
 */
function exportBUltrasound(list) {
  const headers = [
    '记录编号', '动物编号', '操作日期', '妊娠状态', '胎儿阶段',
    '计算胎龄(天)', '标准胎龄(天)', '孕囊', '长径/顶臀径(mm)',
    '双顶径(mm)', '腹围(mm)', '胎心强度', '胎心数值',
    '胎盘成熟度', '胎盘位置', '胎位', '羊水量', '羊水污染',
    '宫颈扩张', '产道异常', '子宫异常', '兽医认定高危',
    '数据状态', '备注', '创建时间'
  ]
  const rows = list.map(item => [
    item.id || '',
    item.animalId || '',
    item.operationDate || '',
    item.pregnancyStatus || '',
    item.fetalStage || '',
    item.calculatedAge || '',
    item.standardAge || '',
    item.gestationalSac || '',
    item.crl || '',
    item.bpd || '',
    item.abdominalCircumference || '',
    item.fetalHeartStrength || '',
    item.fetalHeartValue || '',
    item.placentaMaturity || '',
    Array.isArray(item.placentaPosition) ? item.placentaPosition.join('、') : (item.placentaPosition || ''),
    item.fetalPosition || '',
    item.amnioticFluid || '',
    item.amnioticFluidPollution || '',
    item.cervicalDilation || '',
    item.birthCanalAbnormality || '',
    item.uterineAbnormality || '',
    item.vetHighRisk || '',
    item.status || '',
    item.remark || '',
    item.createdAt || ''
  ])
  exportToXls('B超检查', 'B超检查记录', headers, rows)
}

/**
 * 导出非B超检查数据
 */
function exportNonBUltrasound(list) {
  const headers = [
    '记录编号', '动物编号', '操作日期',
    '检查部位', '胎位', '产道检查',
    '数据状态', '备注', '创建时间'
  ]
  const rows = list.map(item => [
    item.id || '',
    item.animalId || '',
    item.operationDate || '',
    Array.isArray(item.examParts) ? item.examParts.join('、') : (item.examParts || ''),
    item.fetalPosition || '',
    item.cervicalCheck || '',
    item.status || '',
    item.remark || '',
    item.createdAt || ''
  ])
  exportToXls('非B超检查', '非B超检查记录', headers, rows)
}

module.exports = {
  buildXlsContent,
  exportToXls,
  exportSummary,
  exportBUltrasound,
  exportNonBUltrasound
}
