# 给 CC 的提示词：前端修复（4 个问题）

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 问题 1：日历无法改排期状态

**文件**：`src/components/CalendarView.tsx`

**现象**：排期只有"待安排"状态，没有地方改成"已发布"。编辑弹窗里没有状态下拉选择。

**修复**：在编辑弹窗的表单中，`notes` 字段之后、保存按钮之前，加一个状态下拉：

```tsx
{/* 在 form 的 notes 输入框之后 */}
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted">状态</label>
  <select
    value={editingItem?.status || 'planned'}
    onChange={e => {
      if (editingItem) {
        window.electronAPI?.scheduleUpdate(editingItem.id, { status: e.target.value })
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, status: e.target.value as any } : i))
        setEditingItem(null)
        setShowModal(false)
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

注意：这个下拉直接在选择时就调用 `scheduleUpdate` 并关闭弹窗，不需要点保存按钮。这样用户改状态是即时生效的。

同时在排期卡片上也加一个快捷切换：点击状态标签时弹出一个小菜单切换状态。

---

## 问题 2：日历切换创作者后数据不隔离

**文件**：`src/components/CalendarView.tsx`

**现象**：切换到另一个创作者，日历还能看到第一个创作者的排期。

**根因**：CalendarView 没有用 `useAccount` context，加载数据时没有响应账号切换。

**修复**：

1. 在文件顶部导入 AccountContext：

```tsx
import { useAccount } from '../contexts/AccountContext'
```

2. 在组件内部获取当前账号：

```tsx
const { currentAccount } = useAccount()
```

3. 修改 `loadSchedule` 函数，加上 `currentAccount` 依赖：

```tsx
const loadSchedule = useCallback(async () => {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
  const data = await window.electronAPI?.scheduleList(start, end) || []
  setItems(data)
}, [currentMonth, currentAccount?.id])  // 加上 currentAccount?.id
```

4. 在 `useEffect` 中同时监听 `currentAccount`：

```tsx
useEffect(() => { loadSchedule() }, [loadSchedule, currentAccount?.id])
```

这样切换创作者后日历会自动重新加载。

---

## 问题 3：灵感库无法返回

**文件**：`src/components/TopicsView.tsx`

**现象**：进入灵感库后，不知道怎么返回初始状态（选题列表）。

**修复**：在 `InitialState` 组件或灵感库顶部加一个返回按钮。检查 `TopicsView.tsx` 中的 `goBack` 函数是否被正确绑定到 UI 上。

如果 `goBack` 已经存在但没有 UI 入口，在当前视图的顶部加一个返回按钮：

```tsx
{/* 在 ViewState 不是 'initial' 时显示返回按钮 */}
{viewState !== 'initial' && (
  <button onClick={goBack} className="btn-ghost flex items-center gap-1 text-sm mb-2">
    <CaretLeft className="w-4 h-4" />
    返回
  </button>
)}
```

从 `@phosphor-icons/react` 导入 `CaretLeft`。

---

## 问题 4：选题卡片没有"排期"按钮

**文件**：`src/components/topics/TopicCard.tsx`

**现象**：保存的选题卡片上没有"排期"按钮，无法一键将选题加入日历。

**修复**：在 TopicCard 组件的底部操作栏（`onClick` 按钮旁边），加一个"排期"按钮：

```tsx
import { CalendarBlank } from '@phosphor-icons/react'

// 在 TopicCard 的按钮区域（send-to-chat 按钮旁边）加：
<button
  onClick={(e) => {
    e.stopPropagation()
    window.electronAPI?.scheduleCreate({
      platform: topic.platform,
      title: topic.title,
      notes: topic.reason || '',
    })
    // 可选：toast 提示"已添加到排期"
  }}
  className="flex items-center gap-1 text-xs text-muted hover:text-on-surface transition-colors px-2 py-1 rounded hover:bg-surface-hover"
>
  <CalendarBlank className="w-3.5 h-3.5" weight="bold" />
  排期
</button>
```

注意：TopicCard 目前只接收 `topic`, `onClick`, `isActive` 三个 props。如果需要 toast 提示，可以从父组件传一个 `onSchedule` 回调，或者直接在 TopicCard 里用简单的 `window.alert` 或状态提示。

---

## 验证

1. 日历页面点击排期 → 编辑弹窗有状态下拉 → 选"已发布" → 卡片状态立即变绿
2. 切换创作者 → 日历清空 → 切回来 → 排期恢复
3. 灵感库进入选题详情后 → 有返回按钮 → 点击回到初始状态
4. 保存的选题卡片上有"排期"按钮 → 点击后日历多了一条排期