import { useState, useRef, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import MaterialCards, { extractMaterialData } from './MaterialCards'
import type { Message, Conversation } from '../types/electron'

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

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
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
          const labels: Record<string, string> = {
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
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput('')
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
              const materialData = msg.role === 'assistant' ? extractMaterialData(msg.content) : null
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
                    {/* Copy button */}
                    {msg.role === 'assistant' && msg.content && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="absolute -bottom-8 right-0 text-mute hover:text-on-surface opacity-0 group-hover/bubble:opacity-100 transition-opacity"
                        title="复制"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedId === msg.id ? 'check' : 'content_copy'}
                        </span>
                      </button>
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
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 shrink-0">
        <div className="input-bar max-w-3xl mx-auto">
          <button className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0 mb-0.5">
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
