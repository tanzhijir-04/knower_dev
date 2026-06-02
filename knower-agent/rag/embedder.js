const loadSettings = require('../config')

const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000

async function embed(text) {
  const hash = simpleHash(text)
  const cached = cache.get(hash)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.vec

  const settings = loadSettings
  const baseUrl = (settings.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  const apiKey = settings.apiKey

  if (!apiKey) throw new Error('缺少 API Key，无法调用 embedding 接口')

  const body = {
    model: settings.embeddingModel || 'text-embedding-3-small',
    input: text.slice(0, 8000),
  }

  const resp = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Embedding API error ${resp.status}: ${err}`)
  }

  const data = await resp.json()
  const vec = data.data[0].embedding

  cache.set(hash, { vec, ts: Date.now() })
  return vec
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return String(hash)
}

async function embedBatch(texts) {
  const results = []
  for (const text of texts) {
    results.push(await embed(text))
  }
  return results
}

// BM25 fallback when embedding unavailable
class BM25Search {
  constructor() {
    this.docs = []
    this.avgDl = 0
    this.docFreqs = {}
    this.totalDocs = 0
  }

  addDocument(id, text, metadata = {}) {
    const tokens = tokenize(text)
    this.docs.push({ id, tokens, metadata })
    this.totalDocs++

    const tf = {}
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1
    }
    for (const t of Object.keys(tf)) {
      if (!this.docFreqs[t]) this.docFreqs[t] = 0
      this.docFreqs[t]++
    }
    this.avgDl = this.docs.reduce((s, d) => s + d.tokens.length, 0) / this.totalDocs
  }

  search(query, topK = 5) {
    const queryTokens = tokenize(query)
    const k1 = 1.5, b = 0.75
    const scores = []

    for (const doc of this.docs) {
      let score = 0
      const tf = {}
      for (const t of doc.tokens) tf[t] = (tf[t] || 0) + 1

      for (const t of queryTokens) {
        const f = tf[t] || 0
        const df = this.docFreqs[t] || 0
        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1)
        const tfNorm = (f * (k1 + 1)) / (f + k1 * (1 - b + b * doc.tokens.length / this.avgDl))
        score += idf * tfNorm
      }

      if (score > 0) {
        scores.push({ id: doc.id, score, metadata: doc.metadata })
      }
    }

    scores.sort((a, b) => b.score - a.score)
    return scores.slice(0, topK)
  }

  removeDocument(id) {
    // Rebuild docFreqs without the removed doc
    const removed = this.docs.find(d => d.id === id)
    if (!removed) return

    this.docs = this.docs.filter(d => d.id !== id)
    this.totalDocs = this.docs.length

    // Recalculate docFreqs
    this.docFreqs = {}
    for (const doc of this.docs) {
      const unique = new Set(doc.tokens)
      for (const t of unique) {
        this.docFreqs[t] = (this.docFreqs[t] || 0) + 1
      }
    }
    this.avgDl = this.totalDocs > 0
      ? this.docs.reduce((s, d) => s + d.tokens.length, 0) / this.totalDocs
      : 0
  }

  clear() {
    this.docs = []
    this.docFreqs = {}
    this.totalDocs = 0
    this.avgDl = 0
  }
}

function tokenize(text) {
  // Split Chinese into individual characters, keep Latin words as-is
  const tokens = []
  const normalized = text.toLowerCase()
  let i = 0
  while (i < normalized.length) {
    const ch = normalized[i]
    if (ch >= '一' && ch <= '鿿') {
      // Chinese character — emit as single-char token
      tokens.push(ch)
      i++
    } else if (/\w/.test(ch)) {
      // Latin/digit word
      let word = ''
      while (i < normalized.length && /\w/.test(normalized[i])) {
        word += normalized[i]
        i++
      }
      tokens.push(word)
    } else {
      i++
    }
  }
  return tokens.filter(t => t.length > 0)
}

module.exports = { embed, embedBatch, BM25Search, simpleHash }
