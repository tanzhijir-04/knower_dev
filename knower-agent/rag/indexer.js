const { embed, simpleHash } = require('./embedder')
const { upsertVector, deleteVector } = require('./vectorStore')
const { getDb, saveDb } = require('../db')

async function indexScript(accountId, scriptId, content) {
  const db = await getDb()
  const existing = db.exec(
    'SELECT id, content_hash FROM embeddings WHERE source_type = ? AND source_id = ?',
    ['script', scriptId]
  )
  const hash = simpleHash(content)

  if (existing.length && existing[0].values.length) {
    if (existing[0].values[0][1] === hash) return
    await deleteVector(accountId, `script_${scriptId}`)
  }

  try {
    const vector = await embed(content.slice(0, 3000))
    await upsertVector(accountId, `script_${scriptId}`, content.slice(0, 3000), {
      _vector: vector,
      sourceType: 'script',
      sourceId: scriptId,
      text: content.slice(0, 3000),
    })
  } catch (err) {
    console.error(`[Indexer] Embedding failed for script ${scriptId}, skipping vector:`, err.message)
    return
  }

  db.run(
    `INSERT OR REPLACE INTO embeddings (account_id, source_type, source_id, content_hash, created_at)
     VALUES (?, 'script', ?, ?, datetime('now','localtime'))`,
    [accountId, scriptId, hash]
  )
  saveDb()
}

async function indexCrawlContent(accountId, contentId, title, desc, platform, playCount, likeCount) {
  const db = await getDb()
  const text = `${title || ''} ${desc || ''}`.trim()
  if (!text) return

  const hash = simpleHash(text)
  const existing = db.exec(
    'SELECT id, content_hash FROM embeddings WHERE source_type = ? AND source_id = ?',
    ['crawl_content', contentId]
  )
  if (existing.length && existing[0].values.length && existing[0].values[0][1] === hash) return

  try {
    const vector = await embed(text.slice(0, 3000))
    await upsertVector(accountId, `crawl_${contentId}`, text.slice(0, 3000), {
      _vector: vector,
      sourceType: 'crawl_content',
      sourceId: contentId,
      title,
      platform,
      playCount: playCount || 0,
      likeCount: likeCount || 0,
      text: text.slice(0, 3000),
    })
  } catch (err) {
    console.error(`[Indexer] Embedding failed for content ${contentId}, skipping vector:`, err.message)
    return
  }

  db.run(
    `INSERT OR REPLACE INTO embeddings (account_id, source_type, source_id, content_hash, created_at)
     VALUES (?, 'crawl_content', ?, ?, datetime('now','localtime'))`,
    [accountId, contentId, hash]
  )
  saveDb()
}

async function indexCrawlBatch(accountId, contents) {
  let indexed = 0
  for (const c of contents) {
    try {
      await indexCrawlContent(
        accountId,
        c.video_id || c.note_id || c.id,
        c.title, c.desc, c.platform,
        c.video_play_count || c.play_count || 0,
        c.liked_count || 0
      )
      indexed++
    } catch (err) {
      console.error(`[Indexer] 索引失败 content_id=${c.id}:`, err.message)
    }
  }
  console.log(`[Indexer] 已索引 ${indexed}/${contents.length} 条内容`)
  return indexed
}

module.exports = { indexScript, indexCrawlContent, indexCrawlBatch }
