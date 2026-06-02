const path = require('path')
const fs = require('fs')

const VECTRA_DIR = path.join(__dirname, '..', '.vectra')

let _Index = null
function loadVectra() {
  if (_Index !== null) return _Index
  try {
    _Index = require('vectra').Index
  } catch (err) {
    console.warn('[VectorStore] vectra 不可用，向量搜索已禁用:', err.message)
    _Index = false
  }
  return _Index
}

function getIndex(accountId = 'default') {
  const Index = loadVectra()
  if (!Index) throw new Error('vectra 未安装或不兼容，无法使用向量搜索')
  const dir = path.join(VECTRA_DIR, accountId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return new Index(path.join(dir, 'vectors'))
}

async function upsertVector(accountId, id, text, metadata = {}) {
  const index = getIndex(accountId)
  await index.upsertVector({
    id: String(id),
    vector: metadata._vector,
    metadata: { text, ...metadata },
  })
}

async function searchVectors(accountId, queryVector, topK = 10) {
  const index = getIndex(accountId)
  const results = await index.queryVectors(queryVector, topK)
  return results.map(r => ({
    id: r.id,
    score: r.score,
    text: r.metadata.text,
    ...r.metadata,
  }))
}

async function deleteVector(accountId, id) {
  const index = getIndex(accountId)
  await index.deleteVector(String(id))
}

module.exports = { upsertVector, searchVectors, deleteVector, getIndex }
