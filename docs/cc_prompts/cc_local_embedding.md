# 知更 Knower · 本地 Embedding 多模型支持

对 `knower-agent/rag/embedder.js`、`knower-agent/config/index.js`、`electron/main.ts`、`src/components/SettingsView.tsx`、`src/types/electron.d.ts`、`electron/preload.ts` 做以下改动。

## 项目约束

- Electron 33 主进程（Node.js），渲染进程 React 18 + TypeScript 5.6 + Tailwind CSS 3.4
- 禁止引入 Python 运行时
- 图标用 @phosphor-icons/react
- CSS 变量在 src/index.css 的 :root 和 .dark 中定义
- 数据库用 sql.js（SQLite WASM），不要引入其他数据库
- 已有 RAG 模块：`knower-agent/rag/embedder.js`（当前只支持远程 API）、`vectorStore.js`、`retriever.js`、`indexer.js`
- 已有配置读取：`knower-agent/config/index.js`（从 Electron settings.json 读取）
- 已有 Settings 持久化：`electron/main.ts` 中的 `readSettings()` / `writeSettings()` 和 `getStore` / `setStore` IPC

## 目标

实现本地 Embedding 模型支持，用户可在设置页选择模型来源：
1. **本地模型**（推荐）：首次使用时自动下载 ONNX 模型，之后离线可用
2. **远程 API**（现有）：使用 OpenAI 兼容的 Embedding API
3. **BM25 降级**（现有）：无模型时自动降级为关键词搜索

三层优先级：本地模型 → 远程 API → BM25

---

## 一、预定义模型列表

在 `knower-agent/rag/embedder.js` 顶部新增模型注册表：

```javascript
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
    languages: ['zh', 'en', 'ja', 'ko', ...],
    recommended: false,
  },
  {
    id: 'bge-m3',
    name: 'BGE M3 多语言',
    description: '568M 参数，最强多语言模型，体积较大',
    repo: 'BAAI/bge-m3',
    size: '~2.3GB',
    dimensions: 1024,
    languages: ['zh', 'en', 'ja', 'ko', ...],
    recommended: false,
  },
]
```

---

## 二、模型下载与缓存管理

### 2.1 新增文件：`knower-agent/rag/modelManager.js`

功能：
- 管理模型下载、缓存、加载
- 模型存储目录：`knower-agent/.models/{modelId}/`
- 使用 `@huggingface/transformers` 的 `pipeline` 和 `AutoModel` 加载 ONNX 模型
- 下载进度通过事件回调通知（用于前端进度条）

```javascript
const path = require('path')
const fs = require('fs')

const MODELS_DIR = path.join(__dirname, '..', '.models')

// 检查模型是否已下载
function isModelDownloaded(modelId) {
  const modelDir = path.join(MODELS_DIR, modelId)
  return fs.existsSync(modelDir) && fs.readdirSync(modelDir).length > 0
}

// 获取模型存储大小
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

// 获取所有已下载模型
function getDownloadedModels() {
  if (!fs.existsSync(MODELS_DIR)) return []
  return fs.readdirSync(MODELS_DIR).filter(id => isModelDownloaded(id))
}

// 加载本地模型（返回 pipeline）
let _pipeline = null
async function loadLocalPipeline(modelId, progressCallback) {
  const { pipeline, env } = require('@huggingface/transformers')
  
  // 设置本地缓存目录
  env.cacheDir = path.join(MODELS_DIR, modelId)
  
  // 如果模型已下载，跳过下载
  if (isModelDownloaded(modelId)) {
    env.allowLocalModels = true
  }
  
  _pipeline = await pipeline('feature-extraction', `onnx-community/${modelId}-ONNX`, {
    progress_callback: progressCallback,
  })
  
  return _pipeline
}

// 生成向量
async function generateEmbedding(text, modelId = 'bge-small-zh-v1.5') {
  const pipeline = await loadLocalPipeline(modelId)
  const output = await pipeline(text.slice(0, 8000), {
    pooling: 'cls',
    normalize: true,
  })
  return Array.from(output.data)
}

// 批量生成向量
async function generateEmbeddings(texts, modelId = 'bge-small-zh-v1.5', progressCallback) {
  const pipeline = await loadLocalPipeline(modelId)
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
```

### 2.2 改造 `knower-agent/rag/embedder.js`

将 `embed()` 函数改为三层降级：

```javascript
async function embed(text) {
  // 1. 检查缓存
  const hash = simpleHash(text)
  const cached = cache.get(hash)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.vec

  const settings = loadSettings

  // 2. 尝试本地模型
  if (settings.embeddingProvider === 'local' && settings.localEmbeddingModel) {
    try {
      const { generateEmbedding } = require('./modelManager')
      const vec = await generateEmbedding(text, settings.localEmbeddingModel)
      cache.set(hash, { vec, ts: Date.now() })
      return vec
    } catch (err) {
      console.warn('[Embedder] 本地模型失败，尝试远程 API:', err.message)
    }
  }

  // 3. 尝试远程 API（现有逻辑）
  if (settings.apiKey && settings.embeddingModel) {
    try {
      // ... 现有远程 API 代码 ...
    } catch (err) {
      console.warn('[Embedder] 远程 API 失败，降级为 BM25:', err.message)
    }
  }

  // 4. 无 embedding 可用，抛出错误让 retriever 降级为 BM25
  throw new Error('无可用的 embedding 模型')
}
```

---

## 三、配置新增字段

### 3.1 `knower-agent/config/index.js`

新增字段：

```javascript
return {
  // ... 现有字段 ...
  embeddingProvider: raw.embeddingProvider || 'local',  // 'local' | 'api' | 'none'
  localEmbeddingModel: raw.localEmbeddingModel || 'bge-small-zh-v1.5',
  embeddingModel: raw.embeddingModel || 'text-embedding-3-small',
}
```

### 3.2 `electron/main.ts` — `agent-run` handler

在构建 Agent 配置时，读取新的 embedding 配置：

```typescript
embeddingProvider: settings.embeddingProvider as string || 'local',
localEmbeddingModel: settings.localEmbeddingModel as string || 'bge-small-zh-v1.5',
```

---

## 四、前端 SettingsView 改造

### 4.1 替换现有 RAG 配置区域

将 `SettingsView.tsx` 中的 "语义检索 (RAG)" section 替换为：

```tsx
{/* 语义检索 (RAG) */}
<section>
  <h2 className="text-xs uppercase tracking-wider text-muted mb-4">语义检索 (RAG)</h2>
  <div className="card-sm space-y-4">
    
    {/* 模型来源选择 */}
    <div>
      <label className="block text-xs text-muted mb-2">Embedding 模型来源</label>
      <div className="flex gap-2">
        {[
          { value: 'local', label: '本地模型（推荐）', icon: HardDrive },
          { value: 'api', label: '远程 API', icon: Cloud },
          { value: 'none', label: '关闭', icon: X },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => update('embeddingProvider', opt.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
              settings.embeddingProvider === opt.value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-hairline text-muted hover:border-hairline-strong'
            }`}
          >
            <opt.icon className="w-4 h-4" />
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {/* 本地模型配置 */}
    {settings.embeddingProvider === 'local' && (
      <div className="space-y-3">
        <div className="grid gap-2">
          {LOCAL_MODELS.map(model => {
            const downloaded = downloadedModels.includes(model.id)
            const isActive = settings.localEmbeddingModel === model.id
            return (
              <div
                key={model.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  isActive ? 'border-primary bg-primary/5' : 'border-hairline hover:border-hairline-strong'
                }`}
                onClick={() => update('localEmbeddingModel', model.id)}
              >
                <input
                  type="radio"
                  checked={isActive}
                  onChange={() => update('localEmbeddingModel', model.id)}
                  className="accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-ink">{model.name}</span>
                    {model.recommended && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">推荐</span>
                    )}
                    {downloaded && (
                      <span className="text-[10px] bg-semantic-success/10 text-semantic-success px-1.5 py-0.5 rounded">已下载</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">{model.description}</p>
                  <p className="text-[10px] text-muted-soft mt-0.5">{model.size} · {model.dimensions}维</p>
                </div>
                {!downloaded ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadModel(model.id) }}
                    className="btn-secondary text-[11px] h-7 px-2.5"
                  >
                    下载
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.id) }}
                    className="text-muted hover:text-semantic-error transition-colors"
                    title="删除模型"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        
        {/* 下载进度条 */}
        {downloadingModel && (
          <div className="bg-surface/50 rounded-lg p-3 border border-hairline">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-ink">正在下载 {downloadingModel.name}...</span>
              <span className="text-[11px] text-muted">{downloadProgress}%</span>
            </div>
            <div className="w-full bg-hairline rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            {downloadStatus && (
              <p className="text-[10px] text-muted mt-1">{downloadStatus}</p>
            )}
          </div>
        )}
      </div>
    )}

    {/* 远程 API 配置（保持现有） */}
    {settings.embeddingProvider === 'api' && (
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1.5">Embedding 模型</label>
          <input
            type="text"
            value={settings.embeddingModel}
            onChange={e => update('embeddingModel', e.target.value)}
            placeholder="text-embedding-3-small"
            className={inputCls}
          />
        </div>
      </div>
    )}

    {/* 说明 */}
    <div className="bg-surface/50 rounded-lg p-3 border border-hairline">
      <p className="text-[11px] text-muted leading-relaxed">
        <span className="font-medium text-ink">说明：</span>
        {settings.embeddingProvider === 'local' && '使用本地 ONNX 模型进行语义搜索，无需 API Key，离线可用。'}
        {settings.embeddingProvider === 'api' && '使用远程 Embedding API，需要 API Key。'}
        {settings.embeddingProvider === 'none' && '语义搜索已关闭，Agent 将使用关键词搜索（BM25）作为降级方案。'}
      </p>
    </div>
  </div>
</section>
```

### 4.2 状态管理

在 SettingsView 组件中新增状态：

```typescript
const [downloadedModels, setDownloadedModels] = useState<string[]>([])
const [downloadingModel, setDownloadingModel] = useState<{ id: string; name: string } | null>(null)
const [downloadProgress, setDownloadProgress] = useState(0)
const [downloadStatus, setDownloadStatus] = useState('')

// 加载已下载模型列表
useEffect(() => {
  window.electronAPI?.getDownloadedModels?.then(setDownloadedModels)
}, [])
```

### 4.3 下载/删除操作

```typescript
const handleDownloadModel = async (modelId: string) => {
  const model = LOCAL_MODELS.find(m => m.id === modelId)
  if (!model) return
  setDownloadingModel({ id: modelId, name: model.name })
  setDownloadProgress(0)
  setDownloadStatus('准备下载...')
  
  try {
    await window.electronAPI?.downloadEmbeddingModel?.(
      modelId,
      (progress: number, status: string) => {
        setDownloadProgress(progress)
        setDownloadStatus(status)
      }
    )
    setDownloadedModels(prev => [...prev, modelId])
    showToast(`模型 ${model.name} 下载完成`, 'success')
  } catch (err) {
    showToast(`下载失败: ${(err as Error).message}`, 'error')
  } finally {
    setDownloadingModel(null)
  }
}

const handleDeleteModel = async (modelId: string) => {
  try {
    await window.electronAPI?.deleteEmbeddingModel?.(modelId)
    setDownloadedModels(prev => prev.filter(id => id !== modelId))
    showToast('模型已删除', 'success')
  } catch (err) {
    showToast(`删除失败: ${(err as Error).message}`, 'error')
  }
}
```

---

## 五、IPC 通道

### 5.1 `electron/main.ts` 新增 IPC handler

```typescript
// 获取已下载的本地模型列表
ipcMain.handle('get-downloaded-models', () => {
  const { getDownloadedModels } = require('../knower-agent/rag/modelManager')
  return getDownloadedModels()
})

// 下载模型
ipcMain.handle('download-embedding-model', async (event, modelId: string) => {
  const { LOCAL_MODELS, isModelDownloaded } = require('../knower-agent/rag/modelManager')
  const model = LOCAL_MODELS.find((m: any) => m.id === modelId)
  if (!model) throw new Error('未知模型')
  
  if (isModelDownloaded(modelId)) return true
  
  // 使用 @huggingface/transformers 下载
  const { pipeline, env } = require('@huggingface/transformers')
  env.cacheDir = path.join(__dirname, '..', 'knower-agent', '.models', modelId)
  
  await pipeline('feature-extraction', model.repo, {
    progress_callback: (progress: any) => {
      if (progress.status === 'progress') {
        event.sender.send('model-download-progress', {
          modelId,
          progress: Math.round(progress.progress || 0),
          status: `下载中... ${progress.file || ''}`,
        })
      } else if (progress.status === 'done') {
        event.sender.send('model-download-progress', {
          modelId,
          progress: 100,
          status: '加载模型...',
        })
      }
    },
  })
  
  return true
})

// 删除模型
ipcMain.handle('delete-embedding-model', async (_event, modelId: string) => {
  const modelDir = path.join(__dirname, '..', 'knower-agent', '.models', modelId)
  if (fs.existsSync(modelDir)) {
    fs.rmSync(modelDir, { recursive: true, force: true })
  }
  return true
})

// 监听下载进度
ipcMain.on('model-download-progress', (_event, data) => {
  // 转发给渲染进程
  mainWindow?.webContents.send('model-download-progress', data)
})
```

### 5.2 `electron/preload.ts` 新增暴露

```typescript
getDownloadedModels: () => ipcRenderer.invoke('get-downloaded-models'),
downloadEmbeddingModel: (modelId: string, onProgress?: (progress: number, status: string) => void) => {
  if (onProgress) {
    ipcRenderer.on('model-download-progress', (_event, data) => {
      if (data.modelId === modelId) {
        onProgress(data.progress, data.status)
      }
    })
  }
  return ipcRenderer.invoke('download-embedding-model', modelId)
},
deleteEmbeddingModel: (modelId: string) => ipcRenderer.invoke('delete-embedding-model', modelId),
```

### 5.3 `src/types/electron.d.ts` 新增类型

```typescript
getDownloadedModels: () => Promise<string[]>
downloadEmbeddingModel: (modelId: string, onProgress?: (progress: number, status: string) => void) => Promise<boolean>
deleteEmbeddingModel: (modelId: string) => Promise<boolean>
```

---

## 六、依赖安装

```bash
cd knower-agent && npm install @huggingface/transformers
```

注意：`@huggingface/transformers` 在 Node.js 环境下会使用 ONNX Runtime Node 后端，性能优于 WASM。

---

## 七、模型缓存目录

在 `knower-agent/.gitignore` 中新增：

```
.models/
```

避免将下载的模型文件提交到 git。

---

## 验收标准

1. 设置页显示三种 Embedding 来源：本地模型 / 远程 API / 关闭
2. 选择"本地模型"后，显示模型列表（3 个候选），每个有名称、描述、体积、维度
3. 未下载的模型显示"下载"按钮，点击后显示进度条
4. 已下载的模型显示"已下载"标签和删除按钮
5. 下载完成后，Agent 调用 search_similar 时自动使用本地模型生成向量
6. 本地模型不可用时，自动降级为远程 API（如果配置了）
7. 远程 API 也不可用时，降级为 BM25
8. 删除模型后，自动降级为下一层
9. `pnpm dev` 启动无报错
10. 模型文件存储在 `knower-agent/.models/` 目录，不提交到 git
