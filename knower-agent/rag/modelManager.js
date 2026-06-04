const path = require('path')
const fs = require('fs')

const LOCAL_MODELS = [
  {
    id: 'bge-small-zh-v1.5',
    name: 'BGE Small 中文',
    description: '轻量中文模型，24M 参数，推荐大多数用户',
    repo: 'onnx-community/bge-small-zh-v1.5-ONNX',
    size: '~192MB',
    dimensions: 512,
    languages: ['zh'],
    recommended: true,
  },
  {
    id: 'multilingual-e5-small',
    name: 'E5 Small 多语言',
    description: '118M 参数，支持 100+ 语言，含中英文',
    repo: 'intfloat/multilingual-e5-small',
    size: '~470MB',
    dimensions: 384,
    languages: ['zh', 'en', 'ja', 'ko'],
    recommended: false,
  },
  {
    id: 'bge-m3',
    name: 'BGE M3 多语言',
    description: '568M 参数，最强多语言模型，体积较大',
    repo: 'BAAI/bge-m3',
    size: '~2.3GB',
    dimensions: 1024,
    languages: ['zh', 'en', 'ja', 'ko'],
    recommended: false,
  },
]

const MODELS_DIR = path.join(__dirname, '..', '.models')

function isModelDownloaded(modelId) {
  const modelDir = path.join(MODELS_DIR, modelId)
  return fs.existsSync(modelDir) && fs.readdirSync(modelDir).length > 0
}

function getModelSize(modelId) {
  const modelDir = path.join(MODELS_DIR, modelId)
  if (!fs.existsSync(modelDir)) return 0
  let total = 0
  for (const file of fs.readdirSync(modelDir)) {
    const stat = fs.statSync(path.join(modelDir, file))
    if (stat.isFile()) total += stat.size
  }
  return total
}

function getDownloadedModels() {
  if (!fs.existsSync(MODELS_DIR)) return []
  return fs.readdirSync(MODELS_DIR).filter(id => isModelDownloaded(id))
}

let _pipeline = null

async function loadLocalPipeline(modelId, progressCallback, hfEndpoint) {
  const { pipeline, env } = require('@huggingface/transformers')

  env.cacheDir = path.join(MODELS_DIR, modelId)
  if (hfEndpoint) env.remoteHost = hfEndpoint

  if (isModelDownloaded(modelId)) {
    env.allowLocalModels = true
  }

  _pipeline = await pipeline('feature-extraction', `onnx-community/${modelId}-ONNX`, {
    progress_callback: progressCallback,
  })

  return _pipeline
}

async function generateEmbedding(text, modelId = 'bge-small-zh-v1.5', hfEndpoint) {
  const pipeline = await loadLocalPipeline(modelId, null, hfEndpoint)
  const output = await pipeline(text.slice(0, 8000), {
    pooling: 'cls',
    normalize: true,
  })
  return Array.from(output.data)
}

async function generateEmbeddings(texts, modelId = 'bge-small-zh-v1.5', progressCallback, hfEndpoint) {
  const pipeline = await loadLocalPipeline(modelId, null, hfEndpoint)
  const results = []
  for (let i = 0; i < texts.length; i++) {
    const output = await pipeline(texts[i].slice(0, 8000), {
      pooling: 'cls',
      normalize: true,
    })
    results.push(Array.from(output.data))
    progressCallback?.(i + 1, texts.length)
  }
  return results
}

module.exports = {
  LOCAL_MODELS,
  isModelDownloaded,
  getModelSize,
  getDownloadedModels,
  loadLocalPipeline,
  generateEmbedding,
  generateEmbeddings,
}
