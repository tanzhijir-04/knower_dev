# 给 CC 的提示词：前端修复 v2（灵感库选题 + 日历问题）

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 核心问题：灵感库一直提示"Agent 未返回选题"

**文件**：`src/components/TopicsView.tsx`

**根因分析**：事件流中 `done` 在 `tool_result` 之后到达，但 `thinkingCompleteRef.current` 还没更新（React state 异步），导致 `done` 事件判断为"没拿到选题"。另外如果 LLM 返回格式异常，`result.topics` 为空数组，也不会设 `thinkingComplete`。

**修复**：替换 TopicsView 中的 agent event listener（约第 97-135 行），改为以下逻辑：

```tsx
// Agent event listener for topic generation
useEffect(() => {
  if (!api) return
  const unsub = api.onTopicAgentEvent((raw) => {
    try {
      const evt: AgentEvent = JSON.parse(raw)
      setAgentEvents(prev => [...prev, evt])

      // 1. 从 tool_result 提取选题
      if (evt.type === 'tool_result' && evt.name === 'suggest_topics') {
        const result = typeof evt.result === 'string' ? JSON.parse(evt.result) : evt.result
        if (result?.topics?.length) {
          setTopics(result.topics)
          setThinkingComplete(true)
          api.saveTopicHistory(platform, 'agent', result.topics).catch(() => {})
          loadHistory()
          setTimeout(() => setViewState('results'), 300)
          return  // 已拿到选题，忽略后续 done
        }
        // topics 为空但没有 error，也标记完成（避免 done 误判）
        if (!result?.error) {
          setThinkingComplete(true)
        }
      }

      // 2. 从 text 事件提取选题（兜底：有些 LLM 会在文本里输出 JSON）
      if (evt.type === 'text' && evt.text) {
        try {
          const match = evt.text.match(/\[[\s\S]*\]/)
          if (match) {
            const parsed = JSON.parse(match[0])
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
              setTopics(parsed)
              setThinkingComplete(true)
              api.saveTopicHistory(platform, 'agent', parsed).catch(() => {})
              loadHistory()
              setTimeout(() => setViewState('results'), 300)
              return
            }
          }
        } catch {}
      }

      // 3. error 事件
      if (evt.type === 'error') {
        setError(evt.message || 'Agent 执行失败')
        showToast(`生成失败: ${evt.message}`, 'error')
        setViewState('initial')
        return
      }

      // 4. done 事件：只在确实没拿到选题时报错
      if (evt.type === 'done') {
        if (topics.length > 0 || thinkingCompleteRef.current) {
          // 已有选题，正常展示
          setViewState('results')
        } else {
          setError('Agent 未返回选题，请重试')
          setViewState('initial')
        }
      }
    } catch { /* ignore parse errors */ }
  })
  return unsub
}, [api, loadHistory, showToast, platform, topics.length])
```

**关键改动**：
1. `tool_result` 拿到选题后 `return`，不再处理后续 `done`
2. 增加从 `text` 事件提取 JSON 数组的兜底逻辑（有些 LLM 不走工具调用，直接在文本里输出选题）
3. `done` 事件改为检查 `topics.length > 0` 而不是只看 `thinkingCompleteRef`，避免 React 异步更新导致的竞态

---

## 问题 1：日历无法改状态

**文件**：`src/components/CalendarView.tsx`

在编辑排期的弹窗表单中（form 的 notes 输入框之后），加一个状态下拉选择器：

```tsx
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted">状态</label>
  <select
    value={editingItem?.status || form.status || 'planned'}
    onChange={e => {
      if (editingItem) {
        window.electronAPI?.scheduleUpdate(editingItem.id, { status: e.target.value })
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, status: e.target.value as ScheduleItem['status'] } : i))
        setEditingItem(null)
        setShowModal(false)
      } else {
        setForm(f => ({ ...f, status: e.target.value }))
      }
    }}
    className="bg-canvas border border-border rounded-md px-2 py-1.5 text-sm text-on-surface"
  >
    <option value="planned">待安排</option>
    <option value="scheduled">已安排</option>
    <option value="published">已发布</option>
    <option value="skipped">已跳过</option>
  </select>
</div>
```

同时确保 `form` state 初始化时加上 `status: 'planned'`，保存时也带上 `status`。

---

## 问题 2：日历切换创作者后数据不隔离

**文件**：`src/components/CalendarView.tsx`

1. 在文件顶部加导入：
```tsx
import { useAccount } from '../contexts/AccountContext'
```

2. 在组件内部加：
```tsx
const { currentAccount } = useAccount()
```

3. 修改 loadSchedule 的 useCallback 依赖：
```tsx
const loadSchedule = useCallback(async () => {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
  const data = await window.electronAPI?.scheduleList(start, end) || []
  setItems(data)
}, [currentMonth, currentAccount?.id])
```

4. useEffect 加上 currentAccount：
```tsx
useEffect(() => { loadSchedule() }, [loadSchedule])
```

---

## 问题 3：选题卡片没有"排期"按钮

**文件**：`src/components/topics/TopicCard.tsx`

在 TopicCard 的操作按钮区域（send-to-chat 按钮旁边），加一个排期按钮：

```tsx
import { CalendarBlank } from '@phosphor-icons/react'

// 在按钮区域加：
<button
  onClick={(e) => {
    e.stopPropagation()
    window.electronAPI?.scheduleCreate({
      platform: topic.platform,
      title: topic.title,
      notes: topic.reason || '',
    })
  }}
  className="flex items-center gap-1 text-xs text-muted hover:text-on-surface transition-colors px-2 py-1 rounded hover:bg-surface-hover"
  title="添加到日历排期"
>
  <CalendarBlank className="w-3.5 h-3.5" weight="bold" />
  排期
</button>
```

---

## 问题 4：灵感库无法返回

**文件**：`src/components/TopicsView.tsx`

检查 `goBack` 函数是否绑定了 UI。如果当前视图不是 initial 时没有返回按钮，在视图顶部加：

```tsx
{viewState !== 'initial' && (
  <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted hover:text-on-surface transition-colors mb-2">
    <CaretLeft className="w-4 h-4" />
    返回
  </button>
)}
```

确保从 `@phosphor-icons/react` 导入了 `CaretLeft`。

---

## 验证

1. 灵感库点"生成选题" → 等待 → 应该显示选题列表，不再报"Agent 未返回选题"
2. 日历编辑弹窗有状态下拉 → 选"已发布" → 卡片变绿
3. 切换创作者 → 日历清空
4. 选题卡片有"排期"按钮 → 点击后日历多一条
5. 灵感库进入详情后有返回按钮