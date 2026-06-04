const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const db = require('../db')

// Table name → column list (snake_case SQL order)
const TABLE_MAP = {
  accounts: ['id', 'name', 'platform', 'uid', 'avatar_url', 'description', 'is_active', 'user_id', 'created_at', 'updated_at'],
  conversations: ['id', 'title', 'is_pinned', 'created_at', 'updated_at', 'account_id'],
  messages: ['id', 'conversation_id', 'role', 'content', 'created_at'],
  memories: ['id', 'account_id', 'type', 'key', 'value', 'evidence', 'weight', 'created_at', 'updated_at'],
  scripts: ['id', 'content', 'analysis', 'result', 'created_at', 'account_id'],
  crawl_tasks: ['id', 'platform', 'keywords', 'crawler_type', 'status', 'result_json', 'created_at', 'completed_at', 'account_id'],
  crawl_content: ['id', 'task_id', 'platform', 'content_type', 'content_id', 'title', 'desc', 'author_name', 'author_id', 'like_count', 'comment_count', 'share_count', 'play_count', 'created_at', 'raw_json', 'category', 'source_uid', 'source_name', 'fetched_at'],
  crawl_creators: ['id', 'task_id', 'platform', 'user_id', 'nickname', 'avatar', 'total_fans', 'total_liked', 'total_play', 'total_note', 'description', 'ip_location', 'other_info', 'raw_json', 'fetched_at'],
  creators: ['uid', 'name', 'avatar_url', 'is_starred', 'is_pinned', 'total_fans', 'last_fetched_at', 'account_id'],
  competitors: ['id', 'platform', 'user_id', 'nickname', 'account_id', 'last_checked_at', 'created_at'],
  saved_topics: ['id', 'platform', 'title', 'reason', 'source', 'estimated_performance', 'tags', 'full_data', 'created_at', 'account_id'],
  topic_history: ['id', 'platform', 'mode', 'topics_json', 'topic_count', 'is_starred', 'created_at', 'account_id'],
  video_analyses: ['id', 'platform', 'source_uid', 'analysis_json', 'video_count', 'overview_json', 'created_at', 'account_id'],
}

function snakeToCamel(col) {
  return col.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function camelToSnake(key) {
  return key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

function tableChecksum(rows) {
  const str = JSON.stringify(rows)
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 8)
}

async function exportData(outputDir, selectedTables) {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true })

  // Get or generate deviceId
  let deviceId = await db.getSyncMeta('device_id')
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    await db.setSyncMeta('device_id', deviceId)
  }

  // Ensure DB is flushed to disk before reading
  db.saveDb()

  const dbInstance = await db.getDb()
  const tables = selectedTables.filter((t) => TABLE_MAP[t])
  const manifest = { version: 1, exportedAt: new Date().toISOString(), deviceId, tables: {} }
  let totalBytes = 0

  for (const tableName of tables) {
    const columns = TABLE_MAP[tableName]
    const res = dbInstance.exec(`SELECT * FROM ${tableName}`)
    const rows = res.length
      ? res[0].values.map((row) => {
          const obj = {}
          columns.forEach((col, i) => {
            const key = snakeToCamel(col)
            let val = row[i]
            // Parse JSON columns that are stored as strings
            if ((col === 'raw_json' || col === 'analysis' || col === 'result' ||
                 col === 'tags' || col === 'full_data' || col === 'topics_json' ||
                 col === 'analysis_json' || col === 'overview_json') && typeof val === 'string') {
              try { val = JSON.parse(val) } catch { /* keep as string */ }
            }
            obj[key] = val
          })
          return obj
        })
      : []

    const filePath = path.join(outputDir, `${tableName}.json`)
    const content = JSON.stringify(rows, null, 2)
    fs.writeFileSync(filePath, content, 'utf-8')
    totalBytes += Buffer.byteLength(content, 'utf-8')

    manifest.tables[tableName] = {
      rowCount: rows.length,
      checksum: tableChecksum(rows),
    }
  }

  // Write manifest
  const manifestPath = path.join(outputDir, 'manifest.json')
  const manifestContent = JSON.stringify(manifest, null, 2)
  fs.writeFileSync(manifestPath, manifestContent, 'utf-8')
  totalBytes += Buffer.byteLength(manifestContent, 'utf-8')

  return { fileCount: tables.length + 1, totalBytes, manifest }
}

module.exports = { exportData, TABLE_MAP, snakeToCamel, camelToSnake }
