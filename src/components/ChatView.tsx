import { useState, useRef, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import MaterialCards, { extractMaterialData } from './MaterialCards'
import type { MaterialData } from './MaterialCards'
import type { Message, Conversation } from '../types/electron'
import type { Page } from '../App'
import { useToast } from '../contexts/ToastContext'
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

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container/50 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-[11px] shrink-0"
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </button>
  )
}

// ---- More Actions Menu ----

function MoreActionsMenu({ onClose, onAction }: { onClose: () => void; onAction: (action: string) => void }) {
  const actions = [
    { icon: 'checklist', label: '拍摄清单', value: '拍摄清单' },
    { icon: 'subtitles', label: '字幕稿', value: '字幕稿' },
    { icon: 'title', label: '标题优化', value: '标题优化' },
    { icon: 'compare', label: '竞品分析', value: '竞品分析' },
    { icon: 'tips_and_updates', label: '创作灵感', value: '创作灵感' },
  ]

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[160px] z-20">
      {actions.map(a => (
        <button key={a.value} onClick={() => { onAction(a.value); onClose() }}
          className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2 transition-colors">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">{a.icon}</span>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-low border border-outline-variant rounded-2xl shadow-2xl w-[400px] max-w-[90vw] animate-msg-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px] text-primary">info</span>
            <span className="text-sm font-medium text-on-surface">需要补充信息</span>
          </div>
          <p className="text-xs text-on-surface-variant">{message}</p>
        </div>
        <div className="px-5 pb-4 space-y-3">
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-[11px] text-mute mb-1">{f.label}</label>
              {f.type === 'select' && f.options ? (
                <select
                  value={formData[f.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [f.name]: e.target.value }))}
                  className="w-full bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">{f.placeholder || '请选择...'}</option>
                  {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  value={formData[f.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-mute outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={e => { if (e.key === 'Enter') onSubmit(formData) }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-surface-container border border-outline-variant text-on-surface text-xs rounded-lg hover:bg-surface-high transition-colors">
            取消
          </button>
          <button onClick={() => onSubmit(formData)} className="flex-1 py-2 bg-primary/15 text-primary text-xs rounded-lg hover:bg-primary/25 transition-colors font-medium">
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
  const toolDataRef = useRef<{ analysis?: Record<string, unknown>; result?: Record<string, unknown> }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const assistantIdRef = useRef('')
  const { showToast } = useToast()

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
      await api.runAgent(userContent, ['bilibili', 'youtube', 'douyin', 'xiaohongshu'])
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
  }

  const handleNewChat = () => {
    setMessages([])
    setConversationId(null)
  }

  const handleDeleteMessage = async (msgId: string) => {
    const api = window.electronAPI
    if (/^\d+$/.test(msgId) && msgId.length < 15) {
      await api?.deleteMessage(Number(msgId))
    }
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  const handleExportMessage = (msg: Message) => {
    const text = msg.role === 'assistant' ? msg.content.replace(/<[^>]+>/g, '') : msg.content
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${msg.role === 'user' ? '提问' : '回答'}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
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

  const prefillPrompt = (action: string) => {
    const templates: Record<string, string> = {
      '生成物料': '请帮我分析以下脚本并生成各平台发布物料：\n\n',
      '分析数据': '请帮我分析以下数据并给出建议：\n\n',
      '选题建议': '基于我的账号数据，帮我推荐5个选题方向',
      '导出结果': '请帮我导出上次生成的物料',
      '拍摄清单': '请为以下脚本生成拍摄清单，只需要拍摄清单，不需要其他平台物料。\n\n要求：\n- 具体到景别（特写/中景/全景/俯拍/跟拍/空镜）\n- 标注每个镜头的预估时长\n- 按拍摄顺序排列\n- 标注需要的道具和场地\n- 输出为表格格式\n\n脚本内容：\n',
      '字幕稿': '请为以下口播稿生成 SRT 格式的字幕文件。\n\n要求：\n- 标准 SRT 格式（序号 + 时间码 + 字幕文本）\n- 中文语速按每秒 3-4 个字估算\n- 每条字幕不超过 20 个字\n- 在自然断句处分割\n- 时间码格式：HH:MM:SS,mmm\n\n口播稿内容：\n',
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
    if (!file) return
    try {
      const text = await readFileAsText(file)
      if (text) {
        setInput(prev => prev ? prev + '\n\n' + text : text)
        setImportedFile(file.name)
        textareaRef.current?.focus()
      }
    } catch { /* ignore */ }
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
            <span className="material-symbols-outlined text-[14px]">description</span>
            {importedFile}
            <button onClick={() => setImportedFile(null)} className="hover:text-on-surface ml-0.5">
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </span>
        </div>
      )}
      <div className="input-bar">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0 mb-0.5"
        >
          <span className="material-symbols-outlined text-[20px]">attach_file</span>
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息给知更 AI..."
          rows={1}
          className="flex-1 bg-transparent text-on-surface text-sm outline-none resize-none placeholder:text-mute leading-5"
          style={{ maxHeight: '120px' }}
        />
        {isStreaming ? (
          <button
            onClick={handleStop}
            className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mb-0.5 transition-all hover:bg-red-500/30"
            title="停止生成"
          >
            <span className="material-symbols-outlined text-red-400 text-[18px]">stop</span>
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/30"
          >
            <span className="material-symbols-outlined text-primary text-[18px]">arrow_upward</span>
          </button>
        )}
      </div>
      {/* Quick action bar */}
      <div className="flex items-center gap-1.5 mt-2 px-1">
        <QuickAction icon="auto_awesome" label="生成物料" onClick={() => prefillPrompt('生成物料')} />
        <QuickAction icon="analytics" label="分析数据" onClick={() => prefillPrompt('分析数据')} />
        <QuickAction icon="lightbulb" label="选题建议" onClick={() => prefillPrompt('选题建议')} />
        <QuickAction icon="download" label="导出结果" onClick={() => prefillPrompt('导出结果')} />
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setShowMoreActions(!showMoreActions)} className="text-mute hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          {showMoreActions && <MoreActionsMenu onClose={() => setShowMoreActions(false)} onAction={prefillPrompt} />}
        </div>
      </div>
      <p className="text-center text-[11px] text-mute mt-2">AI 可能会犯错。请核实重要信息。</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="titlebar-drag h-12 flex items-center px-5 border-b border-border/30 shrink-0">
        <h1 className="text-sm font-medium text-on-surface no-drag">创作台</h1>
        <div className="flex-1" />
        <button
          onClick={handleNewChat}
          className="no-drag text-on-surface-variant hover:text-on-surface transition-colors mr-2"
          title="新对话"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </header>

      {/* Main content area: chat + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat column */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-250 ${canvasOpen ? 'max-w-[calc(100%-420px)]' : ''}`}>
          {/* Messages area */}
          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
            {showWelcome ? (
              <div className="flex flex-col items-center justify-center h-full px-6 max-w-2xl mx-auto">
                <img src={logoSvg} alt="知更" className="w-16 h-16 rounded-2xl mb-4" />
                <h1 className="text-xl font-semibold text-on-surface mb-1">知更 Knower</h1>
                <p className="text-sm text-on-surface-variant mb-8">让创作者比平台更早知道下一步该做什么</p>

                {/* Scattered suggestion tags */}
                <div className="flex flex-wrap justify-center gap-3 max-w-lg mb-8">
                  {[
                    { text: '帮我生成B站物料', icon: 'auto_awesome' },
                    { text: '分析一下我的数据', icon: 'analytics' },
                    { text: '推荐5个科技选题', icon: 'lightbulb' },
                    { text: '导入脚本文件', icon: 'upload_file' },
                    { text: '看看竞品在做什么', icon: 'compare' },
                  ].map((tag, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(tag.text); textareaRef.current?.focus() }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container/60 hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-xs border border-outline-variant/30 hover:border-primary/30"
                    >
                      <span className="material-symbols-outlined text-[14px]">{tag.icon}</span>
                      {tag.text}
                    </button>
                  ))}
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
                    analyze_script: '分析脚本结构',
                    expand_script: '生成各平台物料',
                    save_result: '保存到数据库',
                  }

                  const isNewMsg = msg.id === messages[messages.length - 1]?.id
                  const isCurrentAssistant = isStreaming && msg.id === assistantIdRef.current

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isNewMsg ? 'animate-msg-enter' : ''}`}
                    >
                      <div className={`${msg.role === 'user' ? 'chat-bubble user max-w-[85%]' : 'w-full'} group/bubble relative`}>
                        {/* Tool call cards */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="flex flex-col gap-2 mb-3">
                            {msg.toolCalls.map((tc, i) => {
                              const toolId = `${msg.id}-tool-${i}`
                              const isCollapsed = collapsedTools[toolId] !== false
                              const icon = tc.status === 'running' ? 'sync' : tc.status === 'success' ? 'check_circle' : 'error'
                              const statusClass = tc.status === 'running' ? 'running' : tc.status === 'success' ? 'success' : 'error'
                              const elapsed = tc.endTime ? `${((tc.endTime - tc.startTime) / 1000).toFixed(1)}s` : ''
                              return (
                                <div key={toolId} className="tool-card animate-tool-enter flex">
                                  <div className={`w-0.5 self-stretch rounded-full shrink-0 ${
                                    tc.status === 'running' ? 'bg-primary animate-pulse-green' :
                                    tc.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <button
                                      className="tool-card-header w-full"
                                      onClick={() => setCollapsedTools(prev => ({ ...prev, [toolId]: !isCollapsed }))}
                                    >
                                      <span className={`tool-icon ${statusClass} material-symbols-outlined text-[16px] ${tc.status === 'running' ? 'animate-spin' : ''}`}>{icon}</span>
                                      <span className="text-xs text-on-surface flex-1 text-left">{toolLabels[tc.name] || tc.name}</span>
                                      {elapsed && <span className="text-[10px] text-mute mr-1">{elapsed}</span>}
                                      <span className={`material-symbols-outlined text-[14px] text-mute transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>expand_more</span>
                                    </button>
                                    <div className={`tool-card-body overflow-hidden transition-all duration-200 ease-out ${!isCollapsed ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                      <pre className="text-xs text-on-surface-variant overflow-x-auto whitespace-pre-wrap">{JSON.stringify(tc.input, null, 2)}</pre>
                                      {tc.result && <pre className="text-xs text-green-400 mt-2 overflow-x-auto whitespace-pre-wrap">{typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}</pre>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {msg.role === 'assistant' ? (
                          <div>
                            {textContent && (
                              <div className="prose prose-invert prose-sm max-w-none mb-2">
                                <Markdown>{textContent}</Markdown>
                                {isCurrentAssistant && <span className="typing-cursor" />}
                              </div>
                            )}
                            {materialData && <MaterialCards data={materialData} onOpenCanvas={() => openCanvas(materialData)} />}
                          </div>
                        ) : (
                          <div className="chat-bubble user">{msg.content}</div>
                        )}

                        {/* Message action bar (always visible for assistant) */}
                        {msg.role === 'assistant' && msg.content && (
                          <div className="flex items-center gap-0.5 mt-2">
                            <button onClick={() => handleFeedback(msg.id, 'good')} className="msg-action-btn" title="有帮助">
                              <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                            </button>
                            <button onClick={() => handleFeedback(msg.id, 'bad')} className="msg-action-btn" title="没帮助">
                              <span className="material-symbols-outlined text-[14px]">thumb_down</span>
                            </button>
                            <button onClick={() => handleCopy(msg.id, msg.content)} className="msg-action-btn" title="复制">
                              <span className="material-symbols-outlined text-[14px]">
                                {copiedId === msg.id ? 'check' : 'content_copy'}
                              </span>
                            </button>
                            <button onClick={() => handleExportMessage(msg)} className="msg-action-btn" title="导出">
                              <span className="material-symbols-outlined text-[14px]">ios_share</span>
                            </button>
                            <button onClick={() => handleRegenerate(msg)} className="msg-action-btn" title="重新生成">
                              <span className="material-symbols-outlined text-[14px]">refresh</span>
                            </button>
                            {materialData && (
                              <button onClick={() => openCanvas(materialData)} className="msg-action-btn" title="在面板查看">
                                <span className="material-symbols-outlined text-[14px]">dashboard</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Feedback panel */}
                        {feedbackTarget === msg.id && (
                          <div className="mt-2 bg-surface-container rounded-xl p-3 border border-outline-variant/30">
                            <p className="text-[11px] text-mute mb-2">哪里不满意？</p>
                            <div className="flex flex-wrap gap-1.5">
                              {['内容不准确', '格式不好', '太长了', '没有帮助'].map(reason => (
                                <button key={reason} onClick={() => submitFeedback(msg.id, reason)}
                                  className="px-2.5 py-1 text-[10px] bg-surface-high rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors">
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
                    <div className="chat-bubble assistant flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                      {status && <span className="text-xs text-body ml-1">{status}</span>}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
            {!autoScroll && isStreaming && (
              <button
                onClick={() => { setAutoScroll(true); scrollToBottom() }}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-surface-container border border-outline-variant/30 text-xs text-on-surface shadow-lg hover:bg-surface-high transition-colors flex items-center gap-1.5 animate-msg-enter"
              >
                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                有新消息
              </button>
            )}
          </div>

          {/* Input area */}
          {inputArea}
        </div>

        {/* Canvas side panel */}
        {canvasOpen && (
          <div className="w-[420px] border-l border-outline-variant bg-surface-low flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
              <span className="text-sm font-medium text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">dashboard</span>
                物料面板
              </span>
              <button onClick={() => setCanvasOpen(false)} className="text-mute hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {canvasData && <MaterialCards data={canvasData} />}
            </div>
            <div className="px-4 py-3 border-t border-outline-variant/30 flex gap-2">
              <button onClick={() => {
                if (!canvasData?.result) return
                const text = JSON.stringify(canvasData.result, null, 2)
                navigator.clipboard.writeText(text)
                showToast('已复制全部物料', 'success')
              }} className="flex-1 py-2 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
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
              }} className="flex-1 py-2 bg-surface-container border border-outline-variant text-on-surface text-xs rounded-lg hover:bg-surface-high transition-colors flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">ios_share</span>
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
