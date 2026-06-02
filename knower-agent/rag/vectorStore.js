const { Index } = require('vectra')
const path = require('path')
const fs = require('fs')

const VECTRA_DIR = path.join(__dirname, '..', '.vectra')

function getIndex(accountId = 'default') {
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
