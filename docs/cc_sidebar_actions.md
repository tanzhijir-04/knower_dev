# 给 CC 的提示词：侧边栏对话历史交互增强

## 背景

知更 Knower 的侧边栏"最近对话"列表目前只有点击加载和 hover 显示删除按钮，交互太简陋。参考 Gemini/ChatGPT 的侧边栏设计，需要增加更多操作选项。

## 参考设计（从截图中提取的交互逻辑）

1. **对话条目高级菜单**：左键点击对话条目的更多选项（一般是三个点一样的图标（更多），弹出上下文菜单（重命名、删除、导出、置顶）
2. **Pin 置顶**：对话条目右侧有置顶图标，置顶的对话排在最前面
3. **搜索**：侧边栏顶部有搜索框，实时过滤对话列表
4. **悬停操作**：hover 时显示操作按钮（不只删除，还有更多选项）

## 目标效果

### 3.1 对话条目 hover 态

```
┌──────────────────────────────┐
│ 📄 你是谁呀                   │  ← hover 时右侧出现操作按钮
│                    📌  ✏️  ⋮  │  ← 置顶、编辑、更多
└──────────────────────────────┘
```

hover 时右侧出现三个小图标：
- 📌（push_pin）：置顶/取消置顶
- ✏️（edit）：重命名
- ⋮（more_horiz）：更多操作（点击弹出菜单）

### 3.2 右键菜单（更多操作）

右键点击对话条目或点击 ⋮ 按钮，弹出上下文菜单：

```
┌─────────────────────┐
│ 📋 导出对话记录      │  ← 导出为 txt 文件
│ ✏️ 重命名           │  ← 内联编辑标题
│ 📌 置顶到顶部        │  ← 置顶/取消置顶
│ ──────────────────  │
│ 🗑️ 删除             │  ← 红色，二次确认
└─────────────────────┘
```

### 3.3 搜索框

侧边栏"最近对话"标题上方增加搜索输入框：

```
┌──────────────────────┐
│ 🔍 搜索对话...        │  ← 搜索框，实时过滤
├──────────────────────┤
│ 最近对话              │
│ · 你是谁呀            │
│ · 帮我生成B站物料      │
└──────────────────────┘
```

### 3.4 置顶分组

置顶的对话排在最前面，有一个"置顶"分组标题：

```
📌 置顶
· 帮我生成B站物料

最近对话
· 你是谁呀
· 你好胖
```

---

## 具体改动

### 改动文件

1. `src/components/Sidebar.tsx`（主改动）
2. `knower-agent/db/index.js`（新增 pin/updateTitle 函数）
3. `electron/main.ts`（新增 IPC handler）
4. `electron/preload.ts`（暴露新 API）
5. `src/types/electron.d.ts`（类型声明）

---

### 文件 1：`src/components/Sidebar.tsx`

完整重写对话历史部分。核心改动：

**a) 新增状态**：

```tsx
const [searchQuery, setSearchQuery] = useState('')
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conv: Conversation } | null>(null)
const [editingId, setEditingId] = useState<number | null>(null)
const [editingTitle, setEditingTitle] = useState('')
```

**b) 搜索过滤**：

```tsx
const filteredConversations = conversations.filter(conv =>
  conv.title.toLowerCase().includes(searchQuery.toLowerCase())
)
```

**c) 置顶分组**：

```tsx
const pinned = filteredConversations.filter(c => c.isPinned)
const recent = filteredConversations.filter(c => !c.isPinned)
```

**d) 对话条目重写**：

```tsx
{pinned.length > 0 && (
  <div className="mb-2">
    <div className="px-4 mb-1 flex items-center gap-1">
      <span className="material-symbols-outlined text-[12px] text-mute">push_pin</span>
      <span className="text-[10px] text-mute">置顶</span>
    </div>
    {pinned.map(conv => (
      <ConversationItem
        key={conv.id}
        conv={conv}
        isActive={conversationId === conv.id}
        isEditing={editingId === conv.id}
        editingTitle={editingTitle}
        onEditTitleChange={setEditingTitle}
        onSelect={() => onOpenConversation?.(conv.id)}
        onEdit={() => { setEditingId(conv.id); setEditingTitle(conv.title) }}
        onConfirmEdit={handleConfirmRename}
        onCancelEdit={() => setEditingId(null)}
        onContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, conv })}
        onTogglePin={() => handleTogglePin(conv.id)}
        onDelete={() => handleDeleteConversation(conv.id)}
        onExport={() => handleExportConversation(conv)}
      />
    ))}
  </div>
)}

{recent.length > 0 && (
  <div>
    <div className="px-4 mb-1">
      <span className="text-[10px] text-mute">最近对话</span>
    </div>
    {recent.map(conv => (
      <ConversationItem key={conv.id} ... />
    ))}
  </div>
)}
```

**e) ConversationItem 组件**：

```tsx
function ConversationItem({
  conv, isActive, isEditing, editingTitle, onEditTitleChange,
  onSelect, onEdit, onConfirmEdit, onCancelEdit,
  onContextMenu, onTogglePin, onDelete, onExport,
}: {
  conv: Conversation
  isActive: boolean
  isEditing: boolean
  editingTitle: string
  onEditTitleChange: (t: string) => void
  onSelect: () => void
  onEdit: () => void
  onConfirmEdit: () => void
  onCancelEdit: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onTogglePin: () => void
  onDelete: () => void
  onExport: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-surface-container' : 'hover:bg-surface-container/50'
      }`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="material-symbols-outlined text-[14px] text-mute shrink-0">chat_bubble</span>

      {isEditing ? (
        <input
          autoFocus
          value={editingTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirmEdit()
            if (e.key === 'Escape') onCancelEdit()
          }}
          onBlur={onConfirmEdit}
          className="flex-1 bg-surface-high border border-primary/50 rounded px-2 py-0.5 text-xs text-on-surface outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-xs text-on-surface truncate flex-1">{conv.title}</span>
      )}

      {/* 操作按钮（hover 时显示） */}
      {hovered && !isEditing && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onTogglePin} className="p-1 rounded text-mute hover:text-on-surface hover:bg-surface-high transition-colors" title={conv.isPinned ? '取消置顶' : '置顶'}>
            <span className={`material-symbols-outlined text-[12px] ${conv.isPinned ? 'text-primary' : ''}`}>push_pin</span>
          </button>
          <button onClick={onEdit} className="p-1 rounded text-mute hover:text-on-surface hover:bg-surface-high transition-colors" title="重命名">
            <span className="material-symbols-outlined text-[12px]">edit</span>
          </button>
          <button onClick={(e) => onContextMenu(e)} className="p-1 rounded text-mute hover:text-on-surface hover:bg-surface-high transition-colors" title="更多">
            <span className="material-symbols-outlined text-[12px]">more_horiz</span>
          </button>
        </div>
      )}
    </div>
  )
}
```

**f) 右键菜单组件**：

```tsx
function ContextMenu({ x, y, onClose, onRename, onPin, onExport, onDelete }: {
  x: number; y: number; onClose: () => void
  onRename: () => void; onPin: () => void; onExport: () => void; onDelete: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [onClose])

  const items = [
    { icon: 'edit', label: '重命名', onClick: onRename },
    { icon: 'push_pin', label: '置顶到顶部', onClick: onPin },
    { icon: 'download', label: '导出对话记录', onClick: onExport },
    { icon: 'delete', label: '删除', onClick: onDelete, danger: true },
  ]

  return (
    <div
      className="fixed z-50 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <div key={i}>
          {i === items.length - 1 && <div className="h-px bg-outline-variant mx-2 my-1" />}
          <button
            onClick={() => { item.onClick(); onClose() }}
            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-surface-container transition-colors ${
              item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
```

**g) 处理函数**：

```tsx
const handleConfirmRename = async () => {
  if (editingId && editingTitle.trim()) {
    await window.electronAPI?.renameConversation(editingId, editingTitle.trim())
    // 刷新列表
    loadConversations()
  }
  setEditingId(null)
}

const handleTogglePin = async (id: number) => {
  await window.electronAPI?.togglePinConversation(id)
  loadConversations()
}

const handleDeleteConversation = async (id: number) => {
  // 二次确认
  if (!confirm('确定删除这个对话？')) return
  await window.electronAPI?.deleteConversation(id)
  loadConversations()
}

const handleExportConversation = async (conv: Conversation) => {
  const messages = await window.electronAPI?.getMessages(conv.id)
  if (!messages?.length) return

  const text = messages.map(m => {
    const role = m.role === 'user' ? '用户' : '助手'
    return `[${role}]\n${m.content}\n`
  }).join('\n---\n\n')

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${conv.title || '对话'}_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
```

**h) 搜索框**（加在"最近对话"标题上方）：

```tsx
{currentPage === 'chat' && !collapsed && (
  <div className="flex-1 flex flex-col mt-4 overflow-hidden">
    {/* 搜索框 */}
    <div className="px-2 mb-2">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-mute">search</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索对话..."
          className="w-full bg-surface-container rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-on-surface placeholder:text-mute outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
    </div>

    {/* 对话列表 */}
    <div className="flex-1 overflow-y-auto px-1">
      {/* 置顶分组 */}
      {/* 最近对话分组 */}
    </div>
  </div>
)}
```

---

### 文件 2：`knower-agent/db/index.js`

新增两个函数：

```javascript
async function togglePinConversation(id) {
  const db = await getDb()
  db.run(
    'UPDATE conversations SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id]
  )
  saveDb()
}

async function getConversationPinned(id) {
  const db = await getDb()
  const res = db.exec('SELECT is_pinned FROM conversations WHERE id = ?', [id])
  if (!res.length || !res[0].values.length) return false
  return res[0].values[0][0] === 1
}
```

在 `initTables()` 中给 `conversations` 表增加 `is_pinned` 字段（需要迁移）：

```javascript
// 迁移：如果旧表没有 is_pinned 列，添加
try {
  db.exec('SELECT is_pinned FROM conversations LIMIT 1')
} catch {
  db.exec('ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0')
  saveDb()
}
```

修改 `listConversations` 查询，按 `is_pinned DESC` 排序：

```javascript
async function listConversations(limit = 50) {
  const db = await getDb()
  const res = db.exec(
    'SELECT id, title, is_pinned, created_at, updated_at FROM conversations ORDER BY is_pinned DESC, updated_at DESC LIMIT ?',
    [limit]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    title: row[1],
    isPinned: row[2],
    createdAt: row[3],
    updatedAt: row[4],
  }))
}
```

导出新函数。

---

### 文件 3：`electron/main.ts`

新增 IPC handler：

```typescript
ipcMain.handle('conv-toggle-pin', async (_event, id: number) => {
  await db.togglePinConversation(id)
  return true
})
```

---

### 文件 4：`electron/preload.ts`

新增暴露：

```typescript
togglePinConversation: (id: number) => ipcRenderer.invoke('conv-toggle-pin', id),
```

---

### 文件 5：`src/types/electron.d.ts`

Conversation 接口增加 `isPinned`：

```typescript
export interface Conversation {
  id: number
  title: string
  isPinned?: number  // 新增
  createdAt: string
  updatedAt: string
}
```

ElectronAPI 接口增加：

```typescript
togglePinConversation: (id: number) => Promise<boolean>
```

---

## 验收标准

- [ ] 对话条目 hover 时右侧出现置顶、编辑、更多三个按钮
- [ ] 点击更多按钮或右键，弹出上下文菜单（重命名、置顶、导出、删除）
- [ ] 重命名时变为内联输入框，回车确认，Esc 取消
- [ ] 置顶的对话排在最前面，有"置顶"分组标题
- [ ] 删除有二次确认弹窗
- [ ] 导出为 txt 文件，格式为 `[用户]\n内容\n---\n[助手]\n内容`
- [ ] 搜索框实时过滤对话列表
- [ ] 数据库自动迁移，旧数据不丢失

---

*知更 Knower · 侧边栏交互增强提示词*
