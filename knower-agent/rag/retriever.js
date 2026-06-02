const { embed, BM25Search } = require('./embedder')
const { searchVectors } = require('./vectorStore')
const { getDb } = require('../db')

let bm25 = null

function getBM25() {
  if (!bm25) bm25 = new BM25Search()
  return bm25
}

async function findSimilarScripts(accountId, queryText, topK = 5) {
  try {
    const queryVec = await embed(queryText)
    const results = await searchVectors(accountId, queryVec, topK * 2)
    return results
      .filter(r => r.sourceType === 'script')
      .slice(0, topK)
      .map(r => ({
        id: r.sourceId,
        score: r.score,
        text: (r.text || '').slice(0, 200) + '...',
      }))
  } catch {
    // BM25 fallback
    const bm25 = getBM25()
    const db = await getDb()
    const res = db.exec(
      `SELECT id, content FROM scripts WHERE account_id = ? ORDER BY id DESC LIMIT 200`,
      [accountId]
    )
    if (!res.length) return []
    // Rebuild index if needed
    if (bm25.totalDocs === 0) {
      for (const row of res[0].values) {
        bm25.addDocument(`script_${row[0]}`, row[1] || '', { sourceType: 'script', sourceId: row[0] })
      }
    }
    const results = bm25.search(queryText, topK)
    return results
      .filter(r => r.metadata.sourceType === 'script')
      .map(r => ({
        id: r.metadata.sourceId,
        score: r.score,
        text: (r.metadata.text || '').slice(0, 200) + '...',
      }))
  }
}

async function findSimilarContent(accountId, queryText, platform, topK = 10) {
  try {
    const queryVec = await embed(queryText)
    const results = await searchVectors(accountId, queryVec, topK * 2)
    return results
      .filter(r => r.sourceType === 'crawl_content' && (!platform || r.platform === platform))
      .slice(0, topK)
      .map(r => ({
        id: r.sourceId,
        score: r.score,
        title: r.title || (r.text || '').slice(0, 50),
        platform: r.platform,
        playCount: r.playCount || 0,
        likeCount: r.likeCount || 0,
      }))
  } catch {
    // BM25 fallback
    const db = await getDb()
    const platformClause = platform ? `AND platform = ?` : ''
    const params = platform ? [accountId, platform, topK] : [accountId, topK]
    const res = db.exec(
      `SELECT id, title, "desc", platform, play_count, like_count
       FROM crawl_content
       WHERE source_uid IN (SELECT source_uid FROM crawl_content WHERE 1=1 ${platformClause})
       ORDER BY like_count DESC LIMIT ?`,
      params
    )
    if (!res.length) return []
    return res[0].values.map(row => ({
      id: row[0],
      score: 1.0,
      title: row[1] || '',
      platform: row[3],
      playCount: row[4] || 0,
      likeCount: row[5] || 0,
    }))
  }
}

async function findHighEngagementPatterns(accountId, platform, topK = 20) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, title, like_count, comment_count, share_count
     FROM crawl_content
     WHERE platform = ? AND like_count > 100
     ORDER BY like_count DESC
     LIMIT ?`,
    [platform, topK]
  )
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], title: row[1],
    likeCount: row[2], commentCount: row[3], shareCount: row[4],
  }))
}

module.exports = { findSimilarScripts, findSimilarContent, findHighEngagementPatterns, getBM25 }
