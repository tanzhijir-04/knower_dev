const path = require('path')
const fs = require('fs')
const os = require('os')
const exporter = require('./exporter')
const importer = require('./importer')
const db = require('../db')

const PROTOCOLS = {
  git: require('./protocols/git'),
  webdav: require('./protocols/webdav'),
  local: require('./protocols/local'),
}

async function testSync(config) {
  const protocol = PROTOCOLS[config.protocol]
  if (!protocol) return { ok: false, message: `未知协议: ${config.protocol}` }
  return protocol.testConnection(config)
}

async function pushSync(config, selectedTables, onProgress) {
  const protocol = PROTOCOLS[config.protocol]
  if (!protocol) return { success: false, error: `未知协议: ${config.protocol}` }

  const startTime = Date.now()
  let tempDir = null

  try {
    onProgress?.('准备导出数据...')
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knower-sync-'))

    onProgress?.('导出数据库到临时目录...')
    const exportResult = await exporter.exportData(tempDir, selectedTables)

    onProgress?.(`正在推送到 ${config.protocol}...`)
    const pushResult = await protocol.push(tempDir, config)

    const duration = Date.now() - startTime
    await db.addSyncLog(config.protocol, 'push', 'success', pushResult.filesChanged || 0, 0, pushResult.bytesTransferred || 0)

    onProgress?.('推送完成')
    return {
      success: true,
      filesChanged: pushResult.filesChanged || 0,
      bytesTransferred: pushResult.bytesTransferred || 0,
      duration,
    }
  } catch (err) {
    const duration = Date.now() - startTime
    await db.addSyncLog(config.protocol, 'push', 'failed', 0, 0, 0, err.message)
    return { success: false, error: err.message, duration }
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}

async function pullSync(config, selectedTables, onProgress) {
  const protocol = PROTOCOLS[config.protocol]
  if (!protocol) return { success: false, error: `未知协议: ${config.protocol}` }

  const startTime = Date.now()
  let tempDir = null

  try {
    onProgress?.('正在从远端拉取数据...')
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knower-sync-'))

    const pullResult = await protocol.pull(tempDir, config)

    onProgress?.('正在导入数据到本地数据库...')
    const importResult = await importer.importData(tempDir, { selectedTables })

    const duration = Date.now() - startTime
    await db.addSyncLog(config.protocol, 'pull', importResult.errors.length ? 'partial' : 'success',
      Object.values(importResult.imported).reduce((s, n) => s + n, 0), importResult.conflicts, 0,
      importResult.errors.join('; ') || null)

    onProgress?.('拉取完成')
    return {
      success: true,
      imported: importResult.imported,
      conflicts: importResult.conflicts,
      errors: importResult.errors,
      filesChanged: pullResult.filesChanged || 0,
      duration,
    }
  } catch (err) {
    const duration = Date.now() - startTime
    await db.addSyncLog(config.protocol, 'pull', 'failed', 0, 0, 0, err.message)
    return { success: false, error: err.message, duration }
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}

module.exports = { testSync, pushSync, pullSync }
