const { createClient } = require('webdav')
const fs = require('fs')
const path = require('path')

function getClient(config) {
  return createClient(config.url, {
    username: config.username,
    password: config.password,
  })
}

function listFilesRecursive(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

async function testConnection(config) {
  const { url, username, password } = config
  if (!url) return { ok: false, message: '请输入服务器地址' }
  if (!username) return { ok: false, message: '请输入用户名' }

  try {
    const client = getClient(config)
    await client.stat('/')
    return { ok: true, message: '连接成功' }
  } catch (err) {
    return { ok: false, message: `连接失败: ${err.message}` }
  }
}

async function push(localDir, config) {
  const client = getClient(config)
  const files = listFilesRecursive(localDir)
  let bytesTransferred = 0

  for (const filePath of files) {
    const relPath = path.relative(localDir, filePath).replace(/\\/g, '/')
    const content = fs.readFileSync(filePath)
    await client.putFileContents(`/${relPath}`, content, { overwrite: true })
    bytesTransferred += content.length
  }

  return { success: true, filesChanged: files.length, bytesTransferred }
}

async function pull(remoteDir, config) {
  const client = getClient(config)

  // Ensure remoteDir exists
  fs.mkdirSync(remoteDir, { recursive: true })

  // List all files at root
  const contents = await client.getDirectoryContents('/')
  let filesDownloaded = 0

  for (const item of contents) {
    if (item.type === 'file') {
      const fileName = item.basename
      const content = await client.getFileContents(`/${fileName}`)
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
      fs.writeFileSync(path.join(remoteDir, fileName), buffer)
      filesDownloaded++
    }
  }

  return { success: true, filesChanged: filesDownloaded }
}

module.exports = { testConnection, push, pull }
