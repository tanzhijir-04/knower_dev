import { useState } from 'react'
import { PlayCircle, Screencast, Palette, Hash, ListChecks, ChartBar, Check, Copy } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
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
}

const PLATFORMS: { key: string; label: string; icon: ComponentType<{ className?: string }>; color: string }[] = [
  { key: 'bilibili', label: 'B站', icon: PlayCircle, color: '#00a1d6' },
  { key: 'youtube', label: 'YouTube', icon: Screencast, color: '#ff0000' },
  { key: 'douyin', label: '抖音', icon: Palette, color: '#fe2c55' },
  { key: 'xiaohongshu', label: '小红书', icon: Hash, color: '#ff2442' },
  { key: 'checklist', label: '拍摄清单', icon: ListChecks, color: '#6bfb9a' },
]

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
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

function AnalysisCard({ analysis }: { analysis: MaterialData['analysis'] }) {
  if (!analysis) return null
  return (
    <div className="card-sm mb-3">
      <div className="flex items-center gap-2 mb-3">
        <ChartBar className="w-5 h-5 text-primary" />
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

function PlatformTab({ material }: { platform: typeof PLATFORMS[number]; material: PlatformMaterial }) {
  const fields: { key: string; label: string; value?: string }[] = []
  if (material.hook) fields.push({ key: 'hook', label: '前 3 秒钩子', value: material.hook })
  if (material.title) fields.push({ key: 'title', label: '标题', value: material.title })
  if (material.coverTitle) fields.push({ key: 'cover', label: '封面标题', value: material.coverTitle })
  const desc = material.description || material.body
  if (desc) fields.push({ key: 'desc', label: material.description ? '描述' : '正文', value: desc })

  return (
    <div className="space-y-3">
      {fields.map(f => (
        <div key={f.key} className="card-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">{f.label}</span>
            <CopyButton text={f.value!} />
          </div>
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{f.value}</p>
        </div>
      ))}
      {material.tags && material.tags.length > 0 && (
        <div className="card-sm">
          <span className="text-xs text-muted block mb-2">标签</span>
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

function CopyAllButton({ data, activeTab }: { data: MaterialData; activeTab: string }) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  if (activeTab === 'checklist') return null

  const handleCopyAll = async () => {
    const material = (data.result as Record<string, unknown>)[activeTab] as PlatformMaterial | undefined
    if (!material) return
    const parts: string[] = []
    if (material.title) parts.push(`标题：${material.title}`)
    if (material.description || material.body) parts.push(`描述：${material.description || material.body}`)
    if (material.tags?.length) parts.push(`标签：${material.tags.map(t => '#' + t).join(' ')}`)
    await navigator.clipboard.writeText(parts.join('\n'))
    setCopied(true)
    showToast('已复制当前平台物料', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopyAll}
      className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-hairline rounded-lg transition-colors shrink-0"
      title="复制全部"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">复制全部</span>
    </button>
  )
}

export default function MaterialCards({ data }: Props) {
  const [activeTab, setActiveTab] = useState<string>('bilibili')

  if (!data.result && !data.analysis) return null

  return (
    <div className="mt-3 rounded-xl border border-hairline/30 overflow-hidden overflow-x-hidden">
      {/* 分析卡片 */}
      {data.analysis && <div className="px-3 pt-3"><AnalysisCard analysis={data.analysis} /></div>}

      {/* Tab 栏 */}
      <div className="flex border-b border-hairline/30 px-2 overflow-x-auto">
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
            <p.icon className="w-4 h-4" />
            {p.label}
          </button>
        ))}
        <CopyAllButton data={data} activeTab={activeTab} />
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
