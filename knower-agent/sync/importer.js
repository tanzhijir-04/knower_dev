const fs = require('fs')
const path = require('path')
const db = require('../db')
const { TABLE_MAP, camelToSnake } = require('./exporter')

// Tables must be imported in foreign-key dependency order
const IMPORT_ORDER = [
  'accounts',
  'creators',
  'conversations',
  'messages',
  'memories',
  'scripts',
  'crawl_tasks',
  'crawl_content',
  'crawl_creators',
  'competitors',
  'saved_topics',
  'topic_history',
  'video_analyses',
]

// Tables that have an updated_at column for last-write-wins
const TABLES_WITH_UPDATED_AT = new Set([
  'accounts', 'conversations', 'memories', 'creators', 'saved_topics', 'topic_history', 'video_analyses',
])

// Tables where we use INSERT OR REPLACE (have unique constraints)
const TABLES_WITH_UNIQUE = new Set([
  'crawl_content', 'crawl_creators', 'competitors', 'saved_topics',
])

// Tables where we skip remote IDs and deduplicate by content (messages)
const COMPOSITE_KEY_TABLES = new Set(['messages'])

function buildInsertSQL(tableName, columns) {
  const cols = columns.map((c) => `"${c}"`).join(', ')
  const placeholders = columns.map(() => '?').join(', ')
  return `INSERT OR REPLACE INTO ${tableName} (${cols}) VALUES (${placeholders})`
}

function buildInsertIgnoreSQL(tableName, columns) {
  const cols = columns.map((c) => `"${c}"`).join(', ')
  const placeholders = columns.map(() => '?').join(', ')
  return `INSERT OR IGNORE INTO ${tableName} (${cols}) VALUES (${placeholders})`
}

function getLocalMaxId(dbInstance, tableName, pkCol = 'id') {
  const res = dbInstance.exec(`SELECT MAX(${pkCol}) FROM ${tableName}`)
  return (res.length && res[0].values[0][0]) || 0
}

function getLocalUpdated(dbInstance, tableName, pkCol, pkVal) {
  const res = dbInstance.exec(`SELECT updated_at FROM ${tableName} WHERE ${pkCol} = ?`, [pkVal])
  if (!res.length || !res[0].values.length) return null
  return res[0].values[0][0]
}

function localRowExists(dbInstance, tableName, pkCol, pkVal) {
  const res = dbInstance.exec(`SELECT 1 FROM ${tableName} WHERE ${pkCol} = ?`, [pkVal])
  return res.length > 0 && res[0].values.length > 0
}

async function importData(inputDir, options = {}) {
  const { selectedTables = [], deviceId = '' } = options
  const errors = []
  const imported = {}
  let conflicts = 0

  // Read manifest
  const manifestPath = path.join(inputDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    return { imported: {}, skipped: [], conflicts: 0, errors: ['manifest.json not found'] }
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

  // Backup current database
  const dbPath = process.env.KNOWER_DB_PATH || path.join(__dirname, '..', 'knower.db')
  if (fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.pre-sync.${Date.now()}`
    fs.copyFileSync(dbPath, backupPath)
  }

  // Ensure DB is flushed before we start writing
  db.saveDb()
  const dbInstance = await db.getDb()
  const tables = IMPORT_ORDER.filter((t) => selectedTables.includes(t) && TABLE_MAP[t] && fs.existsSync(path.join(inputDir, `${t}.json`)))

  for (const tableName of tables) {
    try {
      const columns = TABLE_MAP[tableName]
      const rows = JSON.parse(fs.readFileSync(path.join(inputDir, `${tableName}.json`), 'utf-8'))
      if (!rows.length) { imported[tableName] = 0; continue }

      const pkCol = tableName === 'creators' ? 'uid' : 'id'

      if (TABLES_WITH_UPDATED_AT.has(tableName)) {
        // Last-write-wins merge
        let count = 0
        for (const row of rows) {
          const pkVal = row[pkCol]
          if (pkVal == null) continue
          const localUpdated = getLocalUpdated(dbInstance, tableName, pkCol, pkVal)
          if (localUpdated && row.updatedAt && row.updatedAt <= localUpdated) {
            conflicts++
            continue // local is newer or same, skip
          }
          const sql = buildInsertSQL(tableName, columns)
          const values = columns.map((c) => {
            const key = camelToSnake(c)
            let val = row[key] !== undefined ? row[key] : row[c]
            if (typeof val === 'object' && val !== null) val = JSON.stringify(val)
            return val
          })
          dbInstance.run(sql, values)
          count++
        }
        imported[tableName] = count
      } else if (COMPOSITE_KEY_TABLES.has(tableName)) {
        // Messages: deduplicate by (conversation_id, role, content)
        let count = 0
        for (const row of rows) {
          const convId = row.conversationId ?? row.conversation_id
          const role = row.role
          const content = row.content
          const check = dbInstance.exec(
            'SELECT 1 FROM messages WHERE conversation_id = ? AND role = ? AND content = ? LIMIT 1',
            [convId, role, content]
          )
          if (check.length && check[0].values.length) { conflicts++; continue }
          const maxId = getLocalMaxId(dbInstance, 'messages') + 1
          dbInstance.run(
            'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
            [maxId, convId, role, content, row.createdAt || row.created_at || new Date().toISOString()]
          )
          count++
        }
        imported[tableName] = count
      } else if (TABLES_WITH_UNIQUE.has(tableName)) {
        // INSERT OR REPLACE for tables with unique constraints
        let count = 0
        for (const row of rows) {
          const sql = buildInsertSQL(tableName, columns)
          const values = columns.map((c) => {
            const key = camelToSnake(c)
            let val = row[key] !== undefined ? row[key] : row[c]
            if (typeof val === 'object' && val !== null) val = JSON.stringify(val)
            return val
          })
          dbInstance.run(sql, values)
          count++
        }
        imported[tableName] = count
      } else {
        // Default: INSERT OR IGNORE by primary key
        const sql = buildInsertIgnoreSQL(tableName, columns)
        let count = 0
        for (const row of rows) {
          const values = columns.map((c) => {
            const key = camelToSnake(c)
            let val = row[key] !== undefined ? row[key] : row[c]
            if (typeof val === 'object' && val !== null) val = JSON.stringify(val)
            return val
          })
          dbInstance.run(sql, values)
          count++
        }
        imported[tableName] = count
      }
    } catch (err) {
      errors.push(`${tableName}: ${err.message}`)
    }
  }

  // Flush to disk
  db.saveDb()

  // Log sync
  const totalImported = Object.values(imported).reduce((s, n) => s + n, 0)
  await db.addSyncLog('import', 'import', errors.length ? 'partial' : 'success', totalImported, conflicts, 0, errors.join('; ') || null)

  return { imported, conflicts, errors }
}

module.exports = { importData, IMPORT_ORDER }
