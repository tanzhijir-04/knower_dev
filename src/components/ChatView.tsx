import { useState, useRef, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import MaterialCards, { extractMaterialData } from './MaterialCards'
import type { MaterialData } from './MaterialCards'
import type { Message, Conversation } from '../types/electron'
import type { Page } from '../App'
import { useToast } from '../contexts/ToastContext'
import { usePlatform } from '../contexts/PlatformContext'
import { useAccount } from '../contexts/AccountContext'
import { animateMessage, modalEnter, modalExit, menuEnter, timelinePillEnter, gsap } from '../lib/gsap'
import { Info, FileText, X, StopCircle, ArrowUp, ArrowDown, Plus, UploadSimple, Lightning, ListChecks, Exam, Sparkle, Lightbulb, PencilSimple, ThumbsUp, ThumbsDown, Check, Copy, Export, ArrowsClockwise, StackSimple, MagicWand, ChartBar, Download, GearSix, MagnifyingGlass, Paperclip } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import logoSvg from '../../assets/logo-sidebar.svg?url'

async function readFileAsText(file: File): Promise<string> {
  if (file.name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }
  return await file.text()
}

interface Props {
  pendingTopic?: import('../types/electron').TopicSuggestion | null
  onTopicConsumed?: () => void
  initialConversationId?: number | null
  onConversationOpened?: () => void
  onNavigate?: (page: Page) => void
  onConversationChange?: () => void
}

// ---- Quick Action Button ----

function QuickAction({ Icon, label, onClick }: { Icon: ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn-ghost flex items-center gap-1.5 text-[12px] shrink-0"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

// ---- More Actions Menu ----

function MoreActionsMenu({ onClose, onAction }: { onClose: () => void; onAction: (action: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const actions = [
    { Icon: ListChecks, label: '拍摄清单', value: '拍摄清单' },
    { Icon: Exam, label: '标题优化', value: '标题优化' },
    { Icon: MagnifyingGlass, label: '竞品分析', value: '竞品分析' },
    { Icon: MagicWand, label: '创作灵感', value: '创作灵感' },
  ]

  useEffect(() => {
    if (ref.current) menuEnter(ref.current)
  }, [])

  return (
    <div ref={ref} className="absolute bottom-full right-0 mb-2 bg-surface border border-hairline rounded-xl py-1 min-w-[160px] z-20">
      {actions.map(a => (
        <button key={a.value} onClick={() => { onAction(a.value); onClose() }}
          className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-canvas flex items-center gap-2 transition-colors">
          <a.Icon className="w-3.5 h-3.5 text-muted" />
          {a.label}
        </button>
      ))}
    </div>
  )
}

// ---- Intent Form Modal ----

function IntentFormModal({ message, fields, onSubmit, onClose }: {
  message: string
  fields: { name: string; label: string; type: string; options?: string[]; placeholder?: string }[]
  onSubmit: (data: Record<string, string>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState<Record<string, string>>({})
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (overlayRef.current && contentRef.current) {
      modalEnter(overlayRef.current, contentRef.current)
    }
  }, [])

  const handleClose = () => {
    if (overlayRef.current && contentRef.current) {
      modalExit(overlayRef.current, contentRef.current, onClose)
    } else {
      onClose()
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handleClose}>
      <div
        ref={contentRef}
        className="bg-surface border border-hairline rounded-2xl w-[400px] max-w-[90vw]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4.5 h-4.5 text-primary" />
            <span className="text-sm font-medium text-ink">需要补充信息</span>
          </div>
          <p className="text-xs text-muted">{message}</p>
        </div>
        <div className="px-5 pb-4 space-y-3">
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-[11px] text-muted mb-1">{f.label}</label>
              {f.type === 'select' && f.options ? (
                <select
                  value={formData[f.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [f.name]: e.target.value }))}
                  className="input w-full text-xs h-9 px-3"
                >
                  <option value="">{f.placeholder || '请选择...'}</option>
                  {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  value={formData[f.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="input w-full text-xs h-9 px-3"
                  onKeyDown={e => { if (e.key === 'Enter') onSubmit(formData) }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleClose} className="flex-1 btn-secondary text-xs h-9">
            取消
          </button>
          <button onClick={() => onSubmit(formData)} className="flex-1 btn-primary text-xs h-9">
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Component ----

export default function ChatView({ pendingTopic, onTopicConsumed, initialConversationId, onConversationOpened, onNavigate, onConversationChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [importedFile, setImportedFile] = useState<string | null>(null)
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({})
  const [autoScroll, setAutoScroll] = useState(true)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [canvasData, setCanvasData] = useState<MaterialData | null>(null)
  const [agentFormRequest, setAgentFormRequest] = useState<{
    message: string
    fields: { name: string; label: string; type: string; options?: string[]; placeholder?: string }[]
  } | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const toolDataRef = useRef<{ analysis?: Record<string, unknown>; result?: Record<string, unknown> }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const assistantIdRef = useRef('')
  const animatedMsgIdsRef = useRef(new Set<string>())
  const { showToast } = useToast()
  const { isWindows } = usePlatform()
  const { activeAccountId, activeAccount } = useAccount()
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>(['bilibili', 'douyin', 'xiaohongshu'])

  // Load default platforms: prioritize active account's platform, fallback to settings
  useEffect(() => {
    if (activeAccount?.platform) {
      const platformMap: Record<string, string> = { bili: 'bilibili', dy: 'douyin', xhs: 'xiaohongshu', wb: 'weibo' }
      const mapped = platformMap[activeAccount.platform]
      if (mapped) {
        setDefaultPlatforms([mapped])
        return
      }
    }
    window.electronAPI?.getStoreAll().then((all) => {
      if (all?.defaultPlatforms && Array.isArray(all.defaultPlatforms)) {
        setDefaultPlatforms(all.defaultPlatforms as string[])
      }
    })
  }, [activeAccount?.platform])

  // Reset chat state when account switches
  useEffect(() => {
    setMessages([])
    setConversationId(null)
    setInput('')
    setIsStreaming(false)
    setStatus('')
    setCanvasOpen(false)
    setCanvasData(null)
    setAgentFormRequest(null)
    animatedMsgIdsRef.current.clear()
  }, [activeAccountId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (autoScroll) scrollToBottom()
  }, [messages, autoScroll])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  // Handle conversation opened from sidebar
  useEffect(() => {
    if (initialConversationId) {
      handleLoadConversation({ id: initialConversationId } as Conversation)
      onConversationOpened?.()
    }
  }, [initialConversationId])

  // Handle incoming topic from TopicsView
  useEffect(() => {
    if (pendingTopic) {
      const platforms = pendingTopic.platforms?.join('、') || 'B站、抖音、小红书'
      const prompt = `请帮我基于以下选题生成各平台的发布物料：\n\n选题：${pendingTopic.title}\n方向：${pendingTopic.reason}\n目标平台：${platforms}`
      setInput(prompt)
      onTopicConsumed?.()
      textareaRef.current?.focus()
    }
  }, [pendingTopic, onTopicConsumed])

  // 监听 Agent 事件
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const unsubscribe = api.onAgentEvent((raw) => {
      try {
        const event = JSON.parse(raw)

        if (event.type === 'text') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === assistantIdRef.current) {
              return [...prev.slice(0, -1), { ...last, content: last.content + event.text }]
            }
            return prev
          })
        } else if (event.type === 'tool_call') {
          if (event.name === 'analyze_script' && event.input?.analysis) {
            toolDataRef.current.analysis = event.input.analysis
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last && last.id === assistantIdRef.current) {
                return [...prev.slice(0, -1), { ...last, toolAnalysis: event.input.analysis }]
              }
              return prev
            })
          } else if (event.name === 'expand_script' && event.input?.result) {
            toolDataRef.current.result = event.input.result
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last && last.id === assistantIdRef.current) {
                return [...prev.slice(0, -1), { ...last, toolResult: event.input.result }]
              }
              return prev
            })
          } else if (event.name === 'save_result') {
            if (!toolDataRef.current.analysis && event.input?.analysis) {
              toolDataRef.current.analysis = event.input.analysis
            }
            if (!toolDataRef.current.result && event.input?.result) {
              toolDataRef.current.result = event.input.result
            }
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === assistantIdRef.current) {
              const toolCalls = [...(last.toolCalls || []), {
                name: event.name,
                input: event.input || {},
                status: 'running' as const,
                startTime: Date.now(),
              }]
              return [...prev.slice(0, -1), { ...last, toolCalls }]
            }
            return prev
          })
          const labels: Record<string, string> = {
            analyze_script: '分析脚本结构...',
            expand_script: '生成各平台物料...',
            save_result: '保存到数据库...',
            crawl_data: '正在爬取数据...',
            query_data: '正在查询数据...',
            request_user_input: '等待用户输入...',
            suggest_topics: '生成选题建议...',
          }
          setStatus(labels[event.name] || `处理中...`)
        } else if (event.type === 'tool_result') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === assistantIdRef.current && last.toolCalls?.length) {
              const toolCalls = [...last.toolCalls]
              const lastTool = toolCalls[toolCalls.length - 1]
              if (lastTool.status === 'running') {
                toolCalls[toolCalls.length - 1] = { ...lastTool, status: 'success', endTime: Date.now(), result: event.content }
                return [...prev.slice(0, -1), { ...last, toolCalls }]
              }
            }
            return prev
          })
          setStatus('')
        } else if (event.type === 'tool_progress') {
          setStatus(event.message || '')
        } else if (event.type === 'form_request') {
          setAgentFormRequest({
            message: event.message,
            fields: event.fields,
          })
          setStatus('请在弹出的表单中填写信息...')
        } else if (event.type === 'done') {
          setIsStreaming(false)
          setStatus('')
        } else if (event.type === 'error') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.id === assistantIdRef.current) {
              return [...prev.slice(0, -1), {
                ...last,
                content: last.content + '\n\n[错误] ' + event.message,
              }]
            }
            return prev
          })
          setIsStreaming(false)
          setStatus('')
        }
      } catch { /* ignore */ }
    })

    return () => unsubscribe()
  }, [])

  const saveMessages = useCallback(async (convId: number, msgs: Message[]) => {
    const api = window.electronAPI
    if (!api) return
    for (const msg of msgs) {
      await api.addMessage(convId, msg.role, msg.content)
    }
  }, [])

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput ?? input
    if (!textToSend.trim() || isStreaming) return

    const api = window.electronAPI
    const userContent = textToSend.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
    }

    let convId = conversationId
    if (!convId && api) {
      convId = await api.createConversation(userContent.slice(0, 30))
      setConversationId(convId)
      onConversationChange?.()
    }

    const assistantId = (Date.now() + 1).toString()
    assistantIdRef.current = assistantId
    toolDataRef.current = {}
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput('')
    setImportedFile(null)
    setIsStreaming(true)
    setStatus('正在分析...')

    if (convId && api) {
      await api.addMessage(convId, 'user', userContent)
    }

    if (api?.runAgent) {
      await api.runAgent(userContent, defaultPlatforms)
    } else {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.id === assistantId) {
          return [...prev.slice(0, -1), {
            ...last,
            content: 'Electron IPC 不可用。请确保在 Electron 中运行。',
          }]
        }
        return prev
      })
      setIsStreaming(false)
      setStatus('')
    }
  }

  const handleAgentFormSubmit = async (data: Record<string, string>) => {
    const api = window.electronAPI
    if (!api) return

    await api.submitAgentForm(data)

    const summary = Object.values(data).filter(Boolean).join('、')
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.id === assistantIdRef.current) {
        return [...prev.slice(0, -1), {
          ...last,
          content: last.content + `\n\n📝 用户提供了：${summary}`,
        }]
      }
      return prev
    })

    setAgentFormRequest(null)
    setStatus('正在处理...')
  }

  // 流式结束后保存助手回复
  useEffect(() => {
    if (isStreaming || !conversationId || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role === 'assistant' && last.content) {
      saveMessages(conversationId, [last]).then(() => onConversationChange?.())
    }
  }, [isStreaming])

  const handleStop = async () => {
    await window.electronAPI?.stopAgent()
    setIsStreaming(false)
    setStatus('')
  }

  const handleCopy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    showToast('已复制到剪贴板', 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleLoadConversation = async (conv: Conversation) => {
    const api = window.electronAPI
    if (!api) return
    const msgs = await api.getMessages(conv.id)
    setMessages(msgs)
    setConversationId(conv.id)
    animatedMsgIdsRef.current.clear()
  }

  const handleNewChat = () => {
    setMessages([])
    setConversationId(null)
    animatedMsgIdsRef.current.clear()
  }

  const handleDeleteMessage = async (msgId: string) => {
    const api = window.electronAPI
    if (/^\d+$/.test(msgId) && msgId.length < 15) {
      await api?.deleteMessage(Number(msgId))
    }
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  const handleExportMessage = (msg: Message) => {
    const role = msg.role === 'user' ? '用户' : '助手'
    const content = msg.role === 'assistant' ? msg.content.replace(/<[^>]+>/g, '') : msg.content
    const md = `# 知更对话 — ${role}\n\n**日期**: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n${content}\n`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${role}_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportAllMessages = () => {
    if (messages.length === 0) return
    const lines = messages.map(msg => {
      const role = msg.role === 'user' ? '用户' : '助手'
      const content = msg.role === 'assistant' ? msg.content.replace(/<[^>]+>/g, '') : msg.content
      return `## ${role}\n\n${content}`
    })
    const md = `# 知更对话记录\n\n**导出时间**: ${new Date().toLocaleString('zh-CN')}\n**消息数**: ${messages.length}\n\n---\n\n${lines.join('\n\n---\n\n')}\n`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `对话记录_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出对话记录 (.md)', 'success')
  }

  const handleFeedback = (msgId: string, type: 'good' | 'bad') => {
    if (type === 'good') {
      showToast('感谢反馈', 'success')
    } else {
      setFeedbackTarget(feedbackTarget === msgId ? null : msgId)
    }
  }

  const submitFeedback = (msgId: string, reason: string) => {
    setFeedbackTarget(null)
    showToast('感谢反馈', 'success')
  }

  const handleRegenerate = (msg: Message) => {
    const idx = messages.indexOf(msg)
    if (idx < 1) return
    const prevUserMsg = messages[idx - 1]
    if (prevUserMsg.role !== 'user') return
    setMessages(prev => prev.slice(0, idx))
    handleSend(prevUserMsg.content)
  }

  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id)
    setEditingContent(msg.content)
  }

  const handleConfirmEdit = async () => {
    if (!editingMsgId || !editingContent.trim()) return
    const msgIndex = messages.findIndex(m => m.id === editingMsgId)
    if (msgIndex < 0) return

    // Update message content and remove all subsequent messages
    setMessages(prev => [
      ...prev.slice(0, msgIndex).map(m =>
        m.id === editingMsgId ? { ...m, content: editingContent.trim() } : m
      ),
      { ...prev[msgIndex], content: editingContent.trim() },
    ])

    setEditingMsgId(null)
    setEditingContent('')

    // Re-send with edited content
    setIsStreaming(true)
    const assistantId = (Date.now() + 1).toString()
    assistantIdRef.current = assistantId
    toolDataRef.current = {}
    setMessages(prev => [
      ...prev.slice(0, msgIndex + 1),
      { id: assistantId, role: 'assistant', content: '' },
    ])

    const api = window.electronAPI
    if (api?.runAgent) {
      await api.runAgent(editingContent.trim(), defaultPlatforms)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const importFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'md', 'docx'].includes(ext || '')) {
      showToast('不支持的文件格式，请使用 .txt / .md / .docx', 'error')
      return
    }
    try {
      const text = await readFileAsText(file)
      if (text.trim()) {
        setInput(prev => prev ? prev + '\n\n' + text.trim() : text.trim())
        setImportedFile(file.name)
        showToast(`已导入 ${file.name}（${text.length} 字）`, 'success')
        textareaRef.current?.focus()
      } else {
        showToast('文件内容为空', 'error')
      }
    } catch (err) {
      showToast('文件读取失败' + ((err as Error).message ? '：' + (err as Error).message : ''), 'error')
    }
  }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await importFile(file)
  }

  const prefillPrompt = (action: string) => {
    const templates: Record<string, string> = {
      '生成物料': '请帮我分析以下脚本并生成各平台发布物料：\n\n',
      '分析数据': '帮我看看我的数据表现怎么样',
      '选题建议': '基于我的账号数据，帮我推荐5个选题方向',
      '导出结果': '请帮我导出上次生成的物料',
      '拍摄清单': '请为以下脚本生成拍摄清单，只需要拍摄清单，不需要其他平台物料。\n\n要求：\n- 具体到景别（特写/中景/全景/俯拍/跟拍/空镜）\n- 标注每个镜头的预估时长\n- 按拍摄顺序排列\n- 标注需要的道具和场地\n- 输出为表格格式\n\n脚本内容：\n',
      '标题优化': '请为以下内容生成四个平台的优化标题。\n\n要求：\n- B站：≤80字，专业感+信息量\n- YouTube：≤60字符，SEO友好\n- 抖音：≤55字，口语化，制造悬念\n- 小红书：≤20字，带emoji\n\n每个平台给 3 个标题选项，标注推荐的那个。\n\n内容：\n',
      '竞品分析': '请分析以下创作者/关键词的内容策略。\n\n先查询该来源的历史数据，然后分析：\n1. 内容定位和风格特征\n2. 高互动内容的共性\n3. 发布频率和时间规律\n4. 值得学习的 3 个策略\n5. 可以差异化的 3 个方向\n\n创作者/关键词：\n',
      '创作灵感': '帮我 brainstorm 一些创作灵感。\n\n要求：\n- 给出 8-10 个选题方向\n- 每个包含：选题标题、内容角度、预估吸引力（高/中/低）、适合平台\n- 覆盖不同类型：教程类、测评类、观点类、故事类\n\n我的创作方向：\n',
    }
    const template = templates[action] || ''
    setInput(prev => prev ? template + prev : template)
    textareaRef.current?.focus()
    setShowMoreActions(false)
  }

  const openCanvas = (data: MaterialData) => {
    setCanvasData(data)
    setCanvasOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await importFile(file)
    e.target.value = ''
  }

  const showWelcome = messages.length === 0

  // ---- Input Area (shared between welcome and chat) ----
  const inputArea = (
    <div className="px-4 pb-4 shrink-0 max-w-3xl mx-auto w-full relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.docx"
        onChange={handleFileImport}
        className="hidden"
      />
      {importedFile && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {importedFile}
            <button onClick={() => setImportedFile(null)} className="hover:text-ink ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}
      <div className="relative">
        {!isStreaming && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-hairline transition-colors z-10"
            title="上传文件 (.txt / .md / .docx)"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息给知更 AI..."
          rows={1}
          className="textarea w-full pl-10 pr-12 min-h-[44px] max-h-[120px]"
        />
        {isStreaming ? (
          <button
            onClick={handleStop}
            className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-semantic-error/15 flex items-center justify-center transition-all hover:bg-semantic-error/25"
            title="停止生成"
          >
            <StopCircle className="w-4.5 h-4.5 text-semantic-error" />
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className={`absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-100 ${
              input.trim()
                ? 'bg-primary text-on-primary hover:bg-primary-active'
                : 'bg-surface-strong text-muted cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4.5 h-4.5" />
          </button>
        )}
      </div>
      {/* Quick action bar */}
      <div className="flex items-center gap-1.5 mt-2 px-1">
        <QuickAction Icon={Sparkle} label="生成物料" onClick={() => prefillPrompt('生成物料')} />
        <QuickAction Icon={ChartBar} label="分析数据" onClick={() => prefillPrompt('分析数据')} />
        <QuickAction Icon={Lightbulb} label="选题建议" onClick={() => prefillPrompt('选题建议')} />
        <QuickAction Icon={Download} label="导出结果" onClick={() => prefillPrompt('导出结果')} />
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setShowMoreActions(!showMoreActions)} className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-hairline transition-colors">
            <Plus className="w-4.5 h-4.5" />
          </button>
          {showMoreActions && <MoreActionsMenu onClose={() => setShowMoreActions(false)} onAction={prefillPrompt} />}
        </div>
      </div>
      <p className="text-center text-[11px] text-muted mt-2">AI 可能会犯错。请核实重要信息。</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className={`titlebar-drag h-12 flex items-center px-5 shrink-0 ${isWindows ? '' : 'border-b border-hairline'}`}>
        <h1 className="text-sm font-medium text-ink no-drag">创作台</h1>
        <div className="flex-1" />
        {messages.length > 0 && (
          <button
            onClick={handleExportAllMessages}
            className="no-drag text-muted hover:text-ink transition-colors mr-2"
            title="导出对话记录 (.md)"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleNewChat}
          className="no-drag text-muted hover:text-ink transition-colors mr-2"
          title="新对话"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Main content area: chat + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat column */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${canvasOpen ? 'max-w-[calc(100%-420px)]' : ''}`}>
          {/* Messages area */}
          <div ref={scrollContainerRef} onScroll={handleScroll} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="flex-1 overflow-y-auto relative">
            {isDragging && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/30 rounded-xl z-20 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <UploadSimple className="w-12 h-12 text-primary mb-2" />
                  <p className="text-sm text-ink">拖放文件到这里导入</p>
                  <p className="text-[11px] text-muted">支持 .txt / .md / .docx</p>
                </div>
              </div>
            )}
            {showWelcome ? (
              <div className="flex flex-col items-center justify-center h-full px-6 max-w-2xl mx-auto">
                <img src={logoSvg} alt="知更" className="w-16 h-16 rounded-2xl mb-6" />
                <h1 className="text-[36px] font-normal text-ink mb-2" style={{ lineHeight: 1.2, letterSpacing: '-0.72px' }}>知更 Knower</h1>
                <p className="text-[16px] text-muted mb-8" style={{ lineHeight: 1.5 }}>让创作者比平台更早知道下一步该做什么</p>

                {/* 快速开始卡片 */}
                <button className="card w-full max-w-md text-left mb-4 hover:border-primary/30 transition-colors group cursor-pointer" onClick={() => textareaRef.current?.focus()}>
                  <div className="flex items-center gap-3">
                    <Lightning className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[14px] font-medium text-ink group-hover:text-primary transition-colors">粘贴脚本，一键生成物料</p>
                      <p className="text-[13px] text-muted">支持 B站 / YouTube / 抖音 / 小红书</p>
                    </div>
                  </div>
                </button>

                {/* 快捷操作 */}
                <div className="flex gap-3 justify-center">
                  <button className="card-sm flex items-center gap-2 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onNavigate?.('data')}>
                    <ChartBar className="w-4 h-4 text-primary" />
                    <span className="text-[14px] text-ink">查看数据</span>
                  </button>
                  <button className="card-sm flex items-center gap-2 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onNavigate?.('settings')}>
                    <GearSix className="w-4 h-4 text-primary" />
                    <span className="text-[14px] text-ink">配置 API</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto">
                {messages.map((msg) => {
                  const textParsed = msg.role === 'assistant' ? extractMaterialData(msg.content) : null
                  const toolData = (msg.toolAnalysis || msg.toolResult)
                    ? { analysis: msg.toolAnalysis, result: msg.toolResult }
                    : null
                  const materialData = toolData || textParsed
                  const textContent = materialData
                    ? msg.content.replace(/```json\s*[\s\S]*?```/g, '').trim()
                    : msg.content

                  const toolLabels: Record<string, string> = {
                    crawl_data: '爬取平台数据',
                    query_data: '查询本地数据',
                    analyze_script: '分析脚本结构',
                    expand_script: '生成各平台物料',
                    suggest_topics: '生成选题建议',
                    save_result: '保存到数据库',
                    request_user_input: '请求补充信息',
                  }

                  const isNewMsg = msg.id === messages[messages.length - 1]?.id
                  const isCurrentAssistant = isStreaming && msg.id === assistantIdRef.current

                  return (
                    <div
                      key={msg.id}
                      ref={isNewMsg && !animatedMsgIdsRef.current.has(msg.id)
                        ? (el) => { if (el) { animateMessage(el, msg.role); animatedMsgIdsRef.current.add(msg.id) } }
                        : undefined}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'w-full'} group/bubble relative`}>
                        {/* Tool call timeline */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {msg.toolCalls.map((tc, i) => {
                              const pillClass = tc.status === 'running' ? 'pill-thinking'
                                : tc.status === 'success' ? 'pill-done'
                                : 'pill-edit'
                              const label = tc.status === 'running' ? 'Thinking'
                                : tc.status === 'success' ? 'Done'
                                : 'Error'
                              const elapsed = tc.endTime ? `${((tc.endTime - tc.startTime) / 1000).toFixed(1)}s` : ''
                              return (
                                <div key={i} ref={(el) => { if (el) timelinePillEnter(el) }} className="flex items-center gap-1.5">
                                  {i > 0 && <span className="text-muted-soft">→</span>}
                                  <span className={`timeline-pill ${pillClass}`}>{label}</span>
                                  <span className="text-[13px] text-muted">{toolLabels[tc.name] || tc.name}</span>
                                  {elapsed && <span className="text-[12px] text-muted-soft">{elapsed}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {msg.role === 'assistant' ? (
                          <div>
                            {textContent && (
                              <div className="prose prose-sm max-w-none mb-2">
                                <Markdown>{textContent}</Markdown>
                                {isCurrentAssistant && <span className="typing-cursor" />}
                              </div>
                            )}
                            {materialData && <MaterialCards data={materialData} onOpenCanvas={() => openCanvas(materialData)} />}
                          </div>
                        ) : (
                          editingMsgId === msg.id ? (
                            <div className="card-sm">
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmEdit() }
                                  if (e.key === 'Escape') setEditingMsgId(null)
                                }}
                                className="w-full bg-transparent text-ink text-sm outline-none resize-none leading-relaxed"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <button onClick={handleConfirmEdit} className="btn-primary text-xs h-8 px-3.5">发送</button>
                                <button onClick={() => setEditingMsgId(null)} className="btn-secondary text-xs h-8 px-3.5">取消</button>
                              </div>
                            </div>
                          ) : (
                            <div className="card-sm relative">
                              {msg.content}
                              {!isStreaming && (
                                <button
                                  onClick={() => handleStartEdit(msg)}
                                  className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity text-muted hover:text-ink"
                                  title="编辑"
                                >
                                  <PencilSimple className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        )}

                        {/* Message action bar (always visible for assistant) */}
                        {msg.role === 'assistant' && msg.content && (
                          <div className="msg-actions group-hover:opacity-100">
                            <button onClick={() => handleFeedback(msg.id, 'good')} className="msg-action-btn" title="有帮助">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleFeedback(msg.id, 'bad')} className="msg-action-btn" title="没帮助">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleCopy(msg.id, msg.content)} className="msg-action-btn" title="复制">
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleExportMessage(msg)} className="msg-action-btn" title="导出">
                              <Export className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRegenerate(msg)} className="msg-action-btn" title="重新生成">
                              <ArrowsClockwise className="w-3.5 h-3.5" />
                            </button>
                            {materialData && (
                              <button onClick={() => openCanvas(materialData)} className="msg-action-btn" title="在面板查看">
                                <StackSimple className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Feedback panel */}
                        {feedbackTarget === msg.id && (
                          <div className="mt-2 card-sm p-3">
                            <p className="text-[11px] text-muted mb-2">哪里不满意？</p>
                            <div className="flex flex-wrap gap-1.5">
                              {['内容不准确', '格式不好', '太长了', '没有帮助'].map(reason => (
                                <button key={reason} onClick={() => submitFeedback(msg.id, reason)}
                                  className="badge hover:bg-hairline-strong transition-colors cursor-pointer">
                                  {reason}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                      {status && <span className="text-[13px] text-muted ml-1">{status}</span>}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
            {!autoScroll && isStreaming && (
              <button
                onClick={() => { setAutoScroll(true); scrollToBottom() }}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-surface border border-hairline text-xs text-ink hover:bg-canvas-soft transition-colors flex items-center gap-1.5 animate-fade-in"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                有新消息
              </button>
            )}
          </div>

          {/* Input area */}
          {inputArea}
        </div>

        {/* Canvas side panel */}
        {canvasOpen && (
          <div ref={(el) => { if (el) { el.style.opacity = '0'; gsap.set(el, { x: 20 }); gsap.to(el, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }) } }} className="w-[420px] border-l border-hairline bg-canvas-soft flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <span className="text-sm font-medium text-ink flex items-center gap-2">
                <StackSimple className="w-4 h-4 text-primary" />
                物料面板
              </span>
              <button onClick={() => setCanvasOpen(false)} className="text-muted hover:text-ink">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              {canvasData && <MaterialCards data={canvasData} />}
            </div>
            <div className="px-4 py-3 border-t border-hairline flex gap-2">
              <button onClick={() => {
                if (!canvasData?.result) return
                const text = JSON.stringify(canvasData.result, null, 2)
                navigator.clipboard.writeText(text)
                showToast('已复制全部物料', 'success')
              }} className="flex-1 btn-primary text-xs flex items-center justify-center gap-1">
                <Copy className="w-3.5 h-3.5" />
                复制全部
              </button>
              <button onClick={() => {
                if (!canvasData?.result) return
                const blob = new Blob([JSON.stringify(canvasData.result, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `物料_${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
                showToast('已导出物料', 'success')
              }} className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1">
                <Export className="w-3.5 h-3.5" />
                导出
              </button>
            </div>
          </div>
        )}

        {/* Agent Form Request Modal */}
        {agentFormRequest && (
          <IntentFormModal
            message={agentFormRequest.message}
            fields={agentFormRequest.fields}
            onSubmit={handleAgentFormSubmit}
            onClose={() => setAgentFormRequest(null)}
          />
        )}
      </div>
    </div>
  )
}
