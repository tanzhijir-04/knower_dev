# 给 CC 的提示词：创作台功能补全（移除字幕稿 + 补充遗漏功能）

## 背景

基于用户反馈，对 `cc_chat_redesign.md` 做以下修正：

1. **移除字幕稿功能**（F2）— 不再需要
2. **补充遗漏的 P0 功能**

---

## 修正 1：移除字幕稿

### 涉及文件

- `cc_chat_redesign.md` — 从下拉菜单中移除"字幕稿"选项
- `cc_agent_overhaul.md` — 系统提示词中移除字幕相关意图

### 具体改动

**cc_chat_redesign.md 中 MoreActionsMenu**：

```tsx
// 旧
const actions = [
  { icon: 'checklist', label: '拍摄清单', value: '拍摄清单' },
  { icon: 'subtitles', label: '字幕稿', value: '字幕稿' },      // ← 删除这行
  { icon: 'title', label: '标题优化', value: '标题优化' },
  { icon: 'compare', label: '竞品分析', value: '竞品分析' },
  { icon: 'tips_and_updates', label: '创作灵感', value: '创作灵感' },
]

// 新
const actions = [
  { icon: 'checklist', label: '拍摄清单', value: '拍摄清单' },
  { icon: 'title', label: '标题优化', value: '标题优化' },
  { icon: 'compare', label: '竞品分析', value: '竞品分析' },
  { icon: 'tips_and_updates', label: '创作灵感', value: '创作灵感' },
]
```

**cc_agent_smart.md 中 INTENT_PATTERNS**：

删除 `subtitle` 意图模式：

```tsx
// 删除这个
{
  id: 'subtitle',
  name: '生成字幕',
  icon: 'subtitles',
  keywords: ['生成字幕', '字幕稿', 'SRT', '生成字幕文件'],
  // ...
},
```

**cc_agent_overhaul.md 系统提示词**：

删除意图表中的"生成字幕"行。

---

## 修正 2：补充遗漏的 P0 功能

### 功能 A：对话内容搜索

**需求**：在创作台输入 `/search 关键词` 或使用侧边栏搜索框，能搜索历史对话中的内容。

**实现**：

```tsx
// 搜索逻辑
const searchConversations = async (query: string) => {
  const api = window.electronAPI
  if (!api) return []

  // 查询所有对话的消息内容
  const conversations = await api.listConversations()
  const results: { convId: number; convTitle: string; matches: string[] }[] = []

  for (const conv of conversations) {
    const messages = await api.getMessages(conv.id)
    const matches = messages
      .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
      .map(m => m.content.slice(0, 100))

    if (matches.length > 0) {
      results.push({ convId: conv.id, convTitle: conv.title, matches })
    }
  }

  return results
}
```

需要新增 IPC handler：

```typescript
// main.ts
ipcMain.handle('search-messages', async (_event, query: string) => {
  const conversations = await db.listConversations()
  const results = []
  for (const conv of conversations) {
    const messages = await db.getMessages(conv.id)
    const matches = messages
      .filter((m: any) => m.content.toLowerCase().includes(query.toLowerCase()))
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 200) }))
    if (matches.length > 0) {
      results.push({ convId: conv.id, convTitle: conv.title, matches })
    }
  }
  return results
})
```

### 功能 B：重新生成（Regenerate）

**需求**：助手回复不满意时，可以重新生成。

**实现**：

```tsx
const handleRegenerate = async (msgId: string) => {
  // 找到该助手消息之前的最后一条用户消息
  const msgIndex = messages.findIndex(m => m.id === msgId)
  if (msgIndex < 0) return

  // 向前找到最近的用户消息
  let userMsgIndex = msgIndex - 1
  while (userMsgIndex >= 0 && messages[userMsgIndex].role !== 'user') {
    userMsgIndex--
  }
  if (userMsgIndex < 0) return

  const userMsg = messages[userMsgIndex]

  // 删除当前助手消息及之后的所有消息
  setMessages(prev => prev.slice(0, msgIndex))

  // 重新发送
  setIsStreaming(true)
  const assistantId = (Date.now() + 1).toString()
  assistantIdRef.current = assistantId
  setMessages(prev => [...prev, {
    id: assistantId,
    role: 'assistant',
    content: '',
  }])

  await window.electronAPI?.runAgent(userMsg.content, ['bilibili', 'youtube', 'douyin', 'xiaohongshu'])
}
```

### 功能 C：消息编辑（Edit & Resend）

**需求**：用户可以编辑自己之前的消息，然后重新发送。

**实现**：

```tsx
const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
const [editingContent, setEditingContent] = useState('')

const handleStartEdit = (msg: Message) => {
  setEditingMsgId(msg.id)
  setEditingContent(msg.content)
}

const handleConfirmEdit = async () => {
  if (!editingMsgId || !editingContent.trim()) return

  // 更新消息内容
  setMessages(prev => prev.map(m =>
    m.id === editingMsgId ? { ...m, content: editingContent.trim() } : m
  ))

  // 删除该消息之后的所有消息
  const msgIndex = messages.findIndex(m => m.id === editingMsgId)
  setMessages(prev => prev.slice(0, msgIndex + 1))

  setEditingMsgId(null)
  setEditingContent('')

  // 重新发送
  setIsStreaming(true)
  const assistantId = (Date.now() + 1).toString()
  assistantIdRef.current = assistantId
  setMessages(prev => [...prev, {
    id: assistantId,
    role: 'assistant',
    content: '',
  }])

  await window.electronAPI?.runAgent(editingContent.trim(), ['bilibili', 'youtube', 'douyin', 'xiaohongshu'])
}
```

用户消息 hover 时显示编辑按钮：

```tsx
{msg.role === 'user' && !isStreaming && (
  <button onClick={() => handleStartEdit(msg)} className="msg-action-btn" title="编辑">
    <span className="material-symbols-outlined text-[14px]">edit</span>
  </button>
)}
```

编辑状态：

```tsx
{editingMsgId === msg.id ? (
  <div className="msg-user">
    <div className="msg-user-content">
      <textarea
        value={editingContent}
        onChange={(e) => setEditingContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmEdit() }
          if (e.key === 'Escape') setEditingMsgId(null)
        }}
        className="w-full bg-transparent text-on-surface text-sm outline-none resize-none"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <button onClick={handleConfirmEdit} className="px-3 py-1 bg-primary/20 text-primary text-xs rounded-lg">发送</button>
        <button onClick={() => setEditingMsgId(null)} className="px-3 py-1 bg-surface-container text-on-surface-variant text-xs rounded-lg">取消</button>
      </div>
    </div>
  </div>
) : (
  <div className="msg-user">
    <div className="msg-user-content">{msg.content}</div>
  </div>
)}
```

---

## 改动文件

| 文件 | 改动 |
|---|---|
| `cc_chat_redesign.md` | 移除字幕稿 |
| `cc_agent_smart.md` | 移除字幕意图 |
| `cc_agent_overhaul.md` | 移除字幕意图 |
| `src/components/ChatView.tsx` | 新增搜索/重新生成/消息编辑 |
| `electron/main.ts` | 新增 `search-messages` IPC |
| `electron/preload.ts` | 暴露 `searchMessages` |

---

## 验收标准

- [ ] 字幕稿选项已从所有菜单和意图中移除
- [ ] 侧边栏搜索框能搜索对话内容
- [ ] 助手消息操作栏有"重新生成"按钮
- [ ] 用户消息 hover 时有"编辑"按钮
- [ ] 编辑消息后重新发送，之前的消息被替换
- [ ] 重新生成时删除旧回复，生成新回复

---

*知更 Knower · 创作台功能补全提示词*
