const fs = require('fs')
const path = require('path')

async function testConnection(config) {
  const { folderPath } = config
  if (!folderPath) return { ok: false, message: '请输入目标路径' }

  try {
    const stat = fs.statSync(folderPath)
    if (!stat.isDirectory()) return { ok: false, message: '目标路径不是文件夹' }
    // Test write access
    const testFile = path.join(folderPath, '.knower-write-test')
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
    return { ok: true, message: '路径可读写' }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Directory doesn't exist, try to create it
      try {
        fs.mkdirSync(folderPath, { recursive: true })
        return { ok: true, message: '已创建目录' }
      } catch (createErr) {
        return { ok: false, message: `无法创建目录: ${createErr.message}` }
      }
    }
    return { ok: false, message: `路径不可用: ${err.message}` }
  }
}

async function push(localDir, config) {
  const { folderPath } = config
  fs.mkdirSync(folderPath, { recursive: true })
  fs.cpSync(localDir, folderPath, { recursive: true })
  const files = fs.readdirSync(localDir)
  return { success: true, filesChanged: files.length }
}

async function pull(remoteDir, config) {
  const { folderPath } = config
  fs.mkdirSync(remoteDir, { recursive: true })
  fs.cpSync(folderPath, remoteDir, { recursive: true })
  const files = fs.readdirSync(remoteDir)
  return { success: true, filesChanged: files.length }
}

module.exports = { testConnection, push, pull }
