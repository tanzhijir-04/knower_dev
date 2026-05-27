/**
 * 归一化模块 — 将不同量纲的指标映射到 [0, 100]
 *
 * 核心约束：fit() 只看训练集，transform() 用训练集的分布来映射新值。
 * 这防止了数据泄露（测试集信息泄漏到归一化基准中）。
 */

class PercentileNormalizer {
  constructor() {
    this.sorted = null
    this.n = 0
  }

  fit(trainValues) {
    this.sorted = [...trainValues].filter(v => v != null && isFinite(v)).sort((a, b) => a - b)
    this.n = this.sorted.length
    return this
  }

  transform(value) {
    if (this.n === 0) return 50
    if (value == null || !isFinite(value)) return 50
    const below = this.sorted.filter(v => v < value).length
    return (below / this.n) * 100
  }
}

class MinMaxNormalizer {
  constructor() {
    this.min = 0
    this.max = 1
  }

  fit(trainValues) {
    const valid = trainValues.filter(v => v != null && isFinite(v))
    this.min = Math.min(...valid)
    this.max = Math.max(...valid)
    if (this.max === this.min) this.max = this.min + 1
    return this
  }

  transform(value) {
    if (value == null || !isFinite(value)) return 50
    return ((value - this.min) / (this.max - this.min)) * 100
  }
}

class ZScoreNormalizer {
  constructor() {
    this.mean = 0
    this.std = 1
  }

  fit(trainValues) {
    const valid = trainValues.filter(v => v != null && isFinite(v))
    const n = valid.length
    if (n === 0) return this
    this.mean = valid.reduce((a, b) => a + b, 0) / n
    const variance = valid.reduce((s, v) => s + (v - this.mean) ** 2, 0) / n
    this.std = Math.sqrt(variance) || 1
    return this
  }

  transform(value) {
    if (value == null || !isFinite(value)) return 50
    const z = (value - this.mean) / this.std
    return Math.max(0, Math.min(100, (z + 3) / 6 * 100))
  }
}

class LogMinMaxNormalizer {
  constructor() {
    this.minLog = 0
    this.maxLog = 1
  }

  fit(trainValues) {
    const valid = trainValues.filter(v => v != null && isFinite(v) && v >= 0)
    const logVals = valid.map(v => Math.log(v + 1))
    this.minLog = Math.min(...logVals)
    this.maxLog = Math.max(...logVals)
    if (this.maxLog === this.minLog) this.maxLog = this.minLog + 1
    return this
  }

  transform(value) {
    if (value == null || !isFinite(value) || value < 0) return 50
    const logVal = Math.log(value + 1)
    return ((logVal - this.minLog) / (this.maxLog - this.minLog)) * 100
  }
}

const METHOD_MAP = {
  play_velocity:       'percentile',
  engagement_velocity: 'percentile',
  engagement_rate:     'zscore',
  trend_acceleration:  'logMinMax',
  topic_density:       'minmax',
  freshness_decay:     'minmax',
  category_match:      'minmax',
  title_similarity:    'minmax',
  style_consistency:   'minmax',
  title_structure:     'minmax',
  duration_fit:        'minmax',
  timing_fit:          'minmax',
}

function createNormalizer(method) {
  switch (method) {
    case 'percentile': return new PercentileNormalizer()
    case 'minmax': return new MinMaxNormalizer()
    case 'zscore': return new ZScoreNormalizer()
    case 'logMinMax': return new LogMinMaxNormalizer()
    default: return new PercentileNormalizer()
  }
}

function fitNormalizers(trainData) {
  const normalizers = {}
  for (const [indicator, method] of Object.entries(METHOD_MAP)) {
    const trainValues = trainData.map(d => d[indicator]).filter(v => v != null)
    normalizers[indicator] = createNormalizer(method).fit(trainValues)
  }
  return normalizers
}

function transformRow(row, normalizers) {
  const result = {}
  for (const indicator of Object.keys(METHOD_MAP)) {
    result[indicator] = normalizers[indicator].transform(row[indicator])
  }
  return result
}

module.exports = {
  PercentileNormalizer, MinMaxNormalizer, ZScoreNormalizer, LogMinMaxNormalizer,
  METHOD_MAP, createNormalizer, fitNormalizers, transformRow,
}
