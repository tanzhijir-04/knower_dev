const cache = new Map()
const TTL = 5 * 60 * 1000 // 5 分钟

function getCached(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() - item.timestamp > TTL) {
    cache.delete(key)
    return null
  }
  return item.data
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

function clearCache() {
  cache.clear()
}

module.exports = { getCached, setCache, clearCache }
