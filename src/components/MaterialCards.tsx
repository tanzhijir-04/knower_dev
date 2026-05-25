import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'

interface PlatformMaterial {
  title?: string
  description?: string
  tags?: string[]
  hook?: string
  coverTitle?: string
  body?: string
}

export interface MaterialData {
  analysis?: {
    videoType?: string
    topic?: string
    audience?: string
    duration?: string
    keyPoints?: string[]
  }
  result?: {
    shootingChecklist?: { scene: string; content: string; duration: string; notes?: string }[]
    bilibili?: PlatformMaterial
    douyin?: PlatformMaterial
    xiaohongshu?: PlatformMaterial
    youtube?: PlatformMaterial
  }
}

interface Props {
  data: MaterialData
  onOpenCanvas?: () => void
}

const PLATFORMS = [
  { key: 'bilibili', label: 'B站', icon: 'play_circle', color: '#00a1d6' },
  { key: 'youtube', label: 'YouTube', icon: 'smart_display', color: '#ff0000' },
  { key: 'douyin', label: '抖音', icon: 'music_note', color: '#fe2c55' },
  { key: 'xiaohongshu', label: '小红书', icon: 'style', color: '#ff2442' },
  { key: 'checklist', label: '拍摄清单', icon: 'checklist', color: '#6bfb9a' },
] as const

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast('已复制到剪贴板', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-muted hover:text-ink transition-colors"
      title="复制"
    >
      <span className="material-symbols-outlined text-[16px]">
        {copied ? 'check' : 'content_copy'}
      </span>
    </button>
  )
}

function AnalysisCard({ analysis }: { analysis: MaterialData['analysis'] }) {
  if (!analysis) return null
  return (
    <div className="card-sm mb-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
        <span className="text-sm font-medium text-ink">脚本分析</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted text-xs">视频类型</span>
          <p className="text-ink">{analysis.videoType}</p>
        </div>
        <div>
          <span className="text-muted text-xs">目标受众</span>
          <p className="text-ink">{analysis.audience}</p>
        </div>
        <div>
          <span className="text-muted text-xs">预估时长</span>
          <p className="text-ink">{analysis.duration}</p>
        </div>
        <div>
          <span className="text-muted text-xs">核心主题</span>
          <p className="text-ink">{analysis.topic}</p>
        </div>
      </div>
      {analysis.keyPoints && analysis.keyPoints.length > 0 && (
        <div className="mt-3">
          <span className="text-muted text-xs">关键卖点</span>
          <ul className="mt-1 space-y-1">
            {analysis.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink">
                <span className="text-primary mt-0.5">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PlatformTab({ platform, material }: { platform: typeof PLATFORMS[number]; material: PlatformMaterial }) {
  const formatText = () => {
    const parts: string[] = []
    if (material.title) parts.push(`标题: ${material.title}`)
    if (material.hook) parts.push(`前3秒钩子: ${material.hook}`)
    if (material.description) parts.push(`描述: ${material.description}`)
    if (material.coverTitle) parts.push(`封面标题: ${material.coverTitle}`)
    if (material.body) parts.push(`正文: ${material.body}`)
    if (material.tags?.length) parts.push(`标签: ${material.tags.join(', ')}`)
    return parts.join('\n')
  }

  return (
    <div className="space-y-3">
      {material.hook && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">前 3 秒钩子</span>
            <CopyButton text={material.hook} />
          </div>
          <p className="text-sm text-ink bg-canvas-soft rounded-lg px-3 py-2">{material.hook}</p>
        </div>
      )}
      {material.title && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">标题</span>
            <CopyButton text={material.title} />
          </div>
          <p className="text-sm text-ink bg-canvas-soft rounded-lg px-3 py-2">{material.title}</p>
        </div>
      )}
      {material.coverTitle && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">封面标题</span>
            <CopyButton text={material.coverTitle} />
          </div>
          <p className="text-sm text-ink bg-canvas-soft rounded-lg px-3 py-2">{material.coverTitle}</p>
        </div>
      )}
      {(material.description || material.body) && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">{material.description ? '描述' : '正文'}</span>
            <CopyButton text={material.description || material.body || ''} />
          </div>
          <p className="text-sm text-ink bg-canvas-soft rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed">
            {material.description || material.body}
          </p>
        </div>
      )}
      {material.tags && material.tags.length > 0 && (
        <div>
          <span className="text-xs text-muted block mb-1.5">标签</span>
          <div className="flex flex-wrap gap-1.5">
            {material.tags.map((tag, i) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChecklistTab({ checklist }: { checklist: NonNullable<MaterialData['result']>['shootingChecklist'] }) {
  if (!checklist?.length) return <p className="text-sm text-muted">暂无拍摄清单</p>

  const fullText = checklist
    .map((item, i) => `${i + 1}. [${item.scene}] ${item.content} (${item.duration})${item.notes ? ' - ' + item.notes : ''}`)
    .join('\n')

  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={fullText} />
      </div>
      <div className="space-y-2">
        {checklist.map((item, i) => (
          <div key={i} className="flex items-start gap-3 text-sm bg-surface-low rounded-lg px-3 py-2">
            <span className="text-primary font-medium mt-0.5">{i + 1}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-surface-strong text-muted px-1.5 py-0.5 rounded">
                  {item.scene}
                </span>
                <span className="text-xs text-muted">{item.duration}</span>
              </div>
              <p className="text-ink mt-1">{item.content}</p>
              {item.notes && <p className="text-xs text-muted mt-0.5">{item.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MaterialCards({ data, onOpenCanvas }: Props) {
  const [activeTab, setActiveTab] = useState<string>('bilibili')

  if (!data.result && !data.analysis) return null

  return (
    <div className="mt-3 rounded-xl border border-outline-variant/30 overflow-hidden">
      {/* 分析卡片 */}
      {data.analysis && <div className="px-3 pt-3"><AnalysisCard analysis={data.analysis} /></div>}

      {/* Tab 栏 */}
      <div className="flex border-b border-outline-variant/30 px-2 overflow-x-auto">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveTab(p.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === p.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
            {p.label}
          </button>
        ))}
        {onOpenCanvas && (
          <button
            onClick={onOpenCanvas}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-hairline rounded-lg transition-colors shrink-0"
            title="在面板查看"
          >
            <span className="material-symbols-outlined text-[14px]">dashboard</span>
            <span className="hidden sm:inline">面板</span>
          </button>
        )}
      </div>

      {/* Tab 内容 */}
      <div key={activeTab} className="p-4 animate-msg-enter">
        {activeTab === 'bilibili' && data.result?.bilibili && (
          <PlatformTab platform={PLATFORMS[0]} material={data.result.bilibili} />
        )}
        {activeTab === 'youtube' && data.result?.youtube && (
          <PlatformTab platform={PLATFORMS[1]} material={data.result.youtube} />
        )}
        {activeTab === 'douyin' && data.result?.douyin && (
          <PlatformTab platform={PLATFORMS[2]} material={data.result.douyin} />
        )}
        {activeTab === 'xiaohongshu' && data.result?.xiaohongshu && (
          <PlatformTab platform={PLATFORMS[3]} material={data.result.xiaohongshu} />
        )}
        {activeTab === 'checklist' && (
          <ChecklistTab checklist={data.result?.shootingChecklist} />
        )}
      </div>
    </div>
  )
}

// 从助手消息中提取结构化物料 JSON
export function extractMaterialData(content: string): MaterialData | null {
  // 提取所有 ```json ... ``` 代码块
  const jsonBlocks: string[] = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match
  while ((match = regex.exec(content)) !== null) {
    jsonBlocks.push(match[1].trim())
  }

  if (jsonBlocks.length === 0) return null

  let analysis: MaterialData['analysis'] = undefined
  let result: MaterialData['result'] = undefined

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block)
      if (parsed.analysis) analysis = parsed.analysis
      if (parsed.result) result = parsed.result
    } catch { /* skip invalid json */ }
  }

  if (!analysis && !result) return null
  return { analysis, result }
}
