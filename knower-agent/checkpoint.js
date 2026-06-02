const fs = require('fs')
const path = require('path')

const CHECKPOINT_DIR = path.join(__dirname, '.checkpoints')
const MAX_MESSAGES = 50
const VERSION = 1

function ensureDir() {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
  }
}

function filePath(conversationId) {
  return path.join(CHECKPOINT_DIR, `${conversationId}.json`)
}

function saveCheckpoint(conversationId, state, messages) {
  if (!conversationId) return
  ensureDir()

  const truncated = messages.length > MAX_MESSAGES
    ? messages.slice(-MAX_MESSAGES)
    : messages

  const data = {
    conversationId,
    state: state.serialize ? state.serialize() : JSON.parse(JSON.stringify(state)),
    messages: truncated,
    savedAt: new Date().toISOString(),
    version: VERSION,
  }

  const json = JSON.stringify(data)
  if (Buffer.byteLength(json, 'utf8') > 1024 * 1024) {
    console.warn(`[Checkpoint] 数据超过 1MB，跳过保存 conv=${conversationId}`)
    return
  }

  fs.writeFileSync(filePath(conversationId), json, 'utf8')
}

function loadCheckpoint(conversationId) {
  if (!conversationId) return null
  const fp = filePath(conversationId)
  if (!fs.existsSync(fp)) return null

  try {
    const raw = fs.readFileSync(fp, 'utf8')
    const data = JSON.parse(raw)
    if (data.version !== VERSION) return null
    return data
  } catch {
    return null
  }
}

function clearCheckpoint(conversationId) {
  if (!conversationId) return
  const fp = filePath(conversationId)
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp)
  }
}

function cleanupOldCheckpoints(maxAgeDays = 7) {
  ensureDir()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

  const files = fs.readdirSync(CHECKPOINT_DIR).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const fp = path.join(CHECKPOINT_DIR, f)
    try {
      const stat = fs.statSync(fp)
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fp)
        console.log(`[Checkpoint] 清理过期检查点: ${f}`)
      }
    } catch { /* ignore */ }
  }
}

function hasCheckpoint(conversationId) {
  if (!conversationId) return false
  return fs.existsSync(filePath(conversationId))
}

function listCheckpoints() {
  ensureDir()
  const files = fs.readdirSync(CHECKPOINT_DIR).filter(f => f.endsWith('.json'))
  const results = []
  for (const f of files) {
    try {
      const fp = path.join(CHECKPOINT_DIR, f)
      const raw = fs.readFileSync(fp, 'utf8')
      const data = JSON.parse(raw)
      results.push({
        conversationId: data.conversationId,
        phase: data.state?.phase || 'unknown',
        savedAt: data.savedAt,
        messageCount: data.messages?.length || 0,
      })
    } catch { /* ignore corrupt files */ }
  }
  return results
}

module.exports = {
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
  cleanupOldCheckpoints,
  hasCheckpoint,
  listCheckpoints,
}
