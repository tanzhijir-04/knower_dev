import { useState, useRef, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import MaterialCards, { extractMaterialData } from './MaterialCards'
import type { Message, Conversation } from '../types/electron'

async function readFileAsText(file: File): Promise<string> {
  if (file.name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }
  return await file.text()
}

const WELCOME_MESSAGE = '你好！我是知更 AI，你的智能创作助手。把脚本丢给我，我帮你拆解成各平台的发布物料。'

const SUGGESTIONS = [
  {
    icon: 'edit_note',
    title: '帮我生成 B站/抖音/小红书物料',
    subtitle: '粘贴脚本，一键生成三平台发布内容',
  },
  {
    icon: 'checklist',
    title: '生成拍摄清单',
    subtitle: '分析脚本结构，输出分镜和拍摄安排',
  },
]

interface Props {
  pendingTopic?: import('../types/electron').TopicSuggestion | null
  onTopicConsumed?: () => void
}

export default function ChatView({ pendingTopic, onTopicConsumed }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [importedFile, setImportedFile] = useState<string | null>(null)
  const toolDataRef = useRef<{ analysis?: Record<string, unknown>; result?: Record<string, unknown> }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const assistantIdRef = useRef('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // 加载会话列表
  const loadConversations = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const list = await api.listConversations()
    setConversations(list)
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

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
          const labels: Record<string, string> = {
            analyze_script: '分析脚本结构...',
            expand_script: '生成各平台物料...',
            save_result: '保存到数据库...',
          }
          setStatus(labels[event.name] || `处理中...`)
        } else if (event.type === 'tool_result') {
          setStatus('')
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

  // 保存消息到数据库
  const saveMessages = useCallback(async (convId: number, msgs: Message[]) => {
    const api = window.electronAPI
    if (!api) return
    for (const msg of msgs) {
      await api.addMessage(convId, msg.role, msg.content)
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    const api = window.electronAPI
    const userContent = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
    }

    // 创建或复用会话
    let convId = conversationId
    if (!convId && api) {
      convId = await api.createConversation(userContent.slice(0, 30))
      setConversationId(convId)
      loadConversations()
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

    // 保存用户消息
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

  // 流式结束后保存助手回复
  useEffect(() => {
    if (isStreaming || !conversationId || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role === 'assistant' && last.content) {
      saveMessages(conversationId, [last])
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
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleLoadConversation = async (conv: Conversation) => {
    const api = window.electronAPI
    if (!api) return
    const msgs = await api.getMessages(conv.id)
    setMessages(msgs)
    setConversationId(conv.id)
    setShowHistory(false)
  }

  const handleNewChat = () => {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
  }

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.electronAPI?.deleteConversation(id)
    if (conversationId === id) {
      setMessages([])
      setConversationId(null)
    }
    loadConversations()
  }


  // 删除单条消息
  const handleDeleteMessage = async (msgId: string) => {
    const api = window.electronAPI
    // If id is numeric (from DB), delete from DB too
    if (/^d+$/.test(msgId) && msgId.length < 15) {
      await api?.deleteMessage(Number(msgId))
    }
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  // 导出单条消息为 txt
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

  const handleSuggestionClick = (title: string) => {
    setInput(title)
    textareaRef.current?.focus()
  }

  const showWelcome = messages.length === 0

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
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="no-drag text-on-surface-variant hover:text-on-surface transition-colors"
          title="历史记录"
        >
          <span className="material-symbols-outlined text-[20px]">history</span>
        </button>
      </header>

      {/* History panel */}
      {showHistory && (
        <div className="absolute top-12 right-0 bottom-0 w-72 bg-surface border-l border-border/50 z-10 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <span className="text-sm font-medium text-on-surface">历史对话</span>
            <button onClick={() => setShowHistory(false)} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-xs text-mute text-center py-8">暂无历史记录</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleLoadConversation(conv)}
                  className={`w-full text-left px-4 py-3 border-b border-border/20 hover:bg-surface-container transition-colors group ${conversationId === conv.id ? 'bg-surface-container' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-surface truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="text-mute hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-mute">{conv.updatedAt}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center h-full px-6 max-w-2xl mx-auto">
            <div className="chat-bubble mb-6">{WELCOME_MESSAGE}</div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.title}
                  className="suggestion-card text-left"
                  onClick={() => handleSuggestionClick(s.title)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">{s.icon}</span>
                    <span className="text-sm font-medium text-primary">{s.title}</span>
                  </div>
                  <span className="text-xs text-body">{s.subtitle}</span>
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
              // 移除 JSON 代码块后的纯文本
              const textContent = materialData
                ? msg.content.replace(/```json\s*[\s\S]*?```/g, '').trim()
                : msg.content

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`chat-bubble ${msg.role} group/bubble relative`}>
                    {msg.role === 'assistant' ? (
                      <div>
                        {textContent && (
                          <div className="prose prose-invert prose-sm max-w-none mb-2">
                            <Markdown>{textContent}</Markdown>
                          </div>
                        )}
                        {materialData && <MaterialCards data={materialData} />}
                      </div>
                    ) : (
                      msg.content
                    )}
                    {/* Hover action bar */}
                    <div className="absolute -bottom-9 right-0 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                      {msg.content && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="text-mute hover:text-on-surface p-1 rounded hover:bg-surface-high"
                          title="复制"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedId === msg.id ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => handleExportMessage(msg)}
                        className="text-mute hover:text-on-surface p-1 rounded hover:bg-surface-high"
                        title="导出为文件"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="text-mute hover:text-red-400 p-1 rounded hover:bg-red-500/10"
                        title="删除"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
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
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx"
          onChange={handleFileImport}
          className="hidden"
        />
        {importedFile && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2">
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">description</span>
              {importedFile}
              <button onClick={() => setImportedFile(null)} className="hover:text-on-surface ml-0.5">
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </span>
          </div>
        )}
        <div className="input-bar max-w-3xl mx-auto">
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
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/30"
            >
              <span className="material-symbols-outlined text-primary text-[18px]">arrow_upward</span>
            </button>
          )}
        </div>
        <p className="text-center text-[11px] text-mute mt-2">AI 可能会犯错。请核实重要信息。</p>
      </div>
    </div>
  )
}
