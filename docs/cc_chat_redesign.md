# 给 CC 的提示词：创作台对话交互重设计（参考 Gemini + 豆包）

## 背景

知更 Knower 的创作台对话交互需要全面升级。参考 Gemini 和豆包的设计，提取适合知更创作者场景的交互模式，重新设计输入框、消息操作、欢迎页。

**核心原则**：学习交互逻辑，不照抄视觉。知更是面向视频创作者的工具，所有交互要围绕创作工作流设计。

---

## 设计分析（从截图中提取）

### 豆包的值得学的设计

1. **输入框下方的快捷操作栏**：快速、编程、图像生成、视频生成、帮我写作、翻译、更多。每个操作有图标+文字，点击后预填 prompt 或切换模式。这降低了用户的认知成本——不需要想怎么写 prompt，点一下就行。

2. **"更多"下拉菜单**：展开后显示更多操作分类（音乐生成、深入研究、AI播客、记录会议、解题答疑、数据分析、超能模式、PPT生成）。每个操作有独立图标。

3. **欢迎页建议标签**：不是规整的网格布局，而是散落式排列，像思维导图一样自然。这比整齐的 2x2 卡片更有探索感。

### Gemini 的值得学的设计

1. **消息操作栏**：每条助手消息下方有 👍 👎 📋 🔗 ⋯ 按钮。简洁但完整。👎 点击后追问"哪里不满意"，形成反馈闭环。

2. **Canvas 侧边面板**：当输出是结构化内容（文档、代码、物料）时，可以打开右侧 Canvas 面板，在面板中查看/编辑/导出，不干扰对话流。这非常适合知更的物料展示——左侧对话，右侧物料面板。

3. **输入框集成**：左侧 "+" 上传附件，中间输入文字，右侧模型选择器 + 语音按钮。所有操作集中在一行。

4. **侧边栏折叠态**：只显示图标，hover 时 tooltip 显示文字。展开后显示完整导航 + 对话历史。

---

## 知更的适配方案

### 1. 输入框重新设计

**当前**：简单的 textarea + 发送按钮。

**目标**：

```
┌─────────────────────────────────────────────────────────┐
│ 💬 输入消息给知更 AI...                                    │
├─────────────────────────────────────────────────────────┤
│ 📎  │  📝生成物料  📊分析数据  💡选题建议  📋导出  │ ➕ │
└─────────────────────────────────────────────────────────┘
```

**结构**：
- **主输入区**：textarea，支持多行输入，placeholder 根据场景变化
- **快捷操作栏**：输入框下方一排操作按钮，每个按钮 = 图标 + 文字
- **左侧**：📎 附件按钮（点击弹出文件选择器，支持 .txt/.md/.docx）
- **右侧**：➕ 按钮（展开更多操作菜单）

**快捷操作按钮（适配创作者场景）**：

| 按钮 | 图标 | 作用 |
|---|---|---|
| 生成物料 | `auto_awesome` | 预填"请帮我分析以下脚本并生成各平台物料：\n\n" |
| 分析数据 | `analytics` | 预填"请帮我分析以下数据并给出建议：\n\n" |
| 选题建议 | `lightbulb` | 预填"基于我的账号数据，帮我推荐5个选题方向" |
| 导出结果 | `download` | 如果有最近的生成结果，预填"请帮我导出上次生成的物料" |

**"更多"下拉菜单**（点击 ➕ 展开）：

| 操作 | 图标 | 作用 |
|---|---|---|
| 拍摄清单 | `checklist` | 预填"请为以下脚本生成拍摄清单" |
| 标题优化 | `title` | 预填"请帮我优化以下标题，适合多平台发布" |
| 竞品分析 | `compare` | 预填"请分析以下竞品账号的内容策略" |
| 创作灵感 | `tips_and_updates` | 预填"帮我 brainstorm 一些创作灵感" |

**点击快捷按钮的行为**：
- 如果输入框为空：预填对应的 prompt 模板
- 如果输入框有内容：在已有内容前加上操作指令，如"请帮我生成以下脚本的物料：\n\n" + 已有内容

### 2. 消息操作栏

**当前**：hover 时显示操作栏（实现不完整）。

**目标**：每条助手消息下方**始终显示**操作栏（不依赖 hover），参考 Gemini 的简洁风格。

```
┌─────────────────────────────────────────────┐
│ 助手消息内容...                               │
│                                             │
│ 👍  👎  📋  📤  🔄                          │
└─────────────────────────────────────────────┘
```

| 按钮 | 图标 | 作用 |
|---|---|---|
| 有帮助 | `thumb_up` | 记录正面反馈 |
| 没帮助 | `thumb_down` | 点击后追问"哪里不满意？" |
| 复制 | `content_copy` | 复制消息全文，显示 toast "已复制" |
| 导出 | `ios_share` | 导出为 txt 文件 |
| 重新生成 | `refresh` | 重新发送上一条用户消息 |

**👎 交互细节**：点击后在操作栏下方展开一个小面板：

```
┌─────────────────────────────────────────────┐
│ 助手消息内容...                               │
│                                             │
│ 👍  👎  📋  📤  🔄                          │
│ ┌─────────────────────────────────────────┐ │
│ │ 哪里不满意？                              │ │
│ │ [内容不准确] [格式不好] [太长了] [其他]    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

点击具体原因后记录反馈，面板关闭，toast 显示"感谢反馈"。

### 3. 工具调用卡片（增强版）

**当前**：简单的折叠卡片。

**目标**：参考 Gemini 的 Canvas 思路，工具调用卡片增加"在面板中查看"按钮。

```
┌─ 🔧 分析脚本 ────────────────── 0.8s ✓ ─┐
│                                          │
│  ▾ 展开详情                               │
│                                          │
│              [📋 复制结果] [📐 在面板查看]  │  ← 新增
└──────────────────────────────────────────┘
```

点击"在面板查看"后，右侧打开一个面板（类似 Gemini Canvas），显示结构化的分析结果。面板可以关闭。

### 4. 物料面板（Canvas 模式）

**当前**：物料内嵌在对话流中。

**目标**：增加 Canvas 模式——物料可以在右侧独立面板中查看，不干扰对话流。

**触发方式**：
- 工具调用卡片中的"在面板查看"按钮
- 消息操作栏中的"📐 查看物料"按钮（如果消息包含物料数据）

**面板布局**：

```
┌──────────────────────────┬─────────────────────┐
│                          │ 📐 物料面板    [✕]   │
│     对话区域              │                     │
│                          │ [B站] [YouTube] ... │
│                          │                     │
│                          │ 标题:               │
│                          │ xxxxxxxxxx          │
│                          │         [📋 复制]   │
│                          │                     │
│                          │ 简介:               │
│                          │ xxxxxxxxxx          │
│                          │         [📋 复制]   │
│                          │                     │
│                          │ 标签:               │
│                          │ #xxx #xxx           │
│                          │         [📋 复制]   │
│                          │                     │
│                          │ [📋 复制全部] [📤 导出]│
├──────────────────────────┴─────────────────────┤
│ 💬 输入消息...                     [📎] [➕]   │
└───────────────────────────────────────────────┘
```

**面板宽度**：约 400px，可拖拽调整。关闭后面板消失，对话区域恢复全宽。

**面板顶部**：标题 + 关闭按钮。
**面板内容**：和现有 MaterialPanel 相同的 tab 切换 + 字段展示。
**面板底部**：一键复制全部 + 导出按钮。

### 5. 欢迎页重设计

**当前**：居中 Logo + 标题 + 引导卡片 + 两个快捷按钮。

**目标**：参考豆包的散落式建议 + Gemini 的简洁输入。

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                    🟢                           │
│              知更 Knower                         │
│      让创作者比平台更早知道下一步该做什么            │
│                                                 │
│     [帮我生成B站物料]    [分析一下我的数据]        │
│                    [推荐5个科技选题]              │
│   [导入脚本文件]         [看看竞品在做什么]        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ 📝 输入消息给知更 AI...                    │    │
│  ├─────────────────────────────────────────┤    │
│  │ 📎  │  📝生成物料  📊分析数据  💡选题  │ ➕ │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**建议标签**：散落式排列（不用网格），每个标签点击后预填到输入框。标签内容根据用户是否有历史数据动态变化：
- 有数据时：显示"分析一下我的数据"、"推荐选题"
- 无数据时：显示"帮我生成B站物料"、"导入脚本文件"

---

## 具体改动

### 改动文件

1. `src/components/ChatView.tsx`（主改动）
2. `src/components/MaterialCards.tsx`（Canvas 面板支持）
3. `src/index.css`（新样式）

### ChatView.tsx 改动清单

**a) 输入框重构**：

```tsx
{/* 输入区域 */}
<div className="px-4 pb-4 shrink-0 max-w-3xl mx-auto w-full">
  {/* 主输入框 */}
  <div className="input-bar">
    <button onClick={handleFileImport} className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
      <span className="material-symbols-outlined text-[20px]">attach_file</span>
    </button>
    <textarea ... />
    <button onClick={handleSend} className="w-8 h-8 rounded-full bg-primary/20 ...">
      <span className="material-symbols-outlined text-primary text-[18px]">arrow_upward</span>
    </button>
  </div>

  {/* 快捷操作栏 */}
  <div className="flex items-center gap-1.5 mt-2 px-1">
    <QuickAction icon="auto_awesome" label="生成物料" onClick={() => prefillPrompt('生成物料')} />
    <QuickAction icon="analytics" label="分析数据" onClick={() => prefillPrompt('分析数据')} />
    <QuickAction icon="lightbulb" label="选题建议" onClick={() => prefillPrompt('选题建议')} />
    <QuickAction icon="download" label="导出结果" onClick={() => prefillPrompt('导出结果')} />
    <div className="flex-1" />
    <button onClick={() => setShowMoreActions(!showMoreActions)} className="text-mute hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors">
      <span className="material-symbols-outlined text-[18px]">add</span>
    </button>
  </div>

  {/* 更多操作下拉 */}
  {showMoreActions && <MoreActionsMenu onClose={() => setShowMoreActions(false)} onAction={prefillPrompt} />}
</div>
```

**b) QuickAction 组件**：

```tsx
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
```

**c) MoreActionsMenu 组件**：

```tsx
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
```

**d) prefillPrompt 函数**：

```tsx
const prefillPrompt = (action: string) => {
  const templates: Record<string, string> = {
    '生成物料': '请帮我分析以下脚本并生成各平台发布物料：\n\n',
    '分析数据': '请帮我分析以下数据并给出建议：\n\n',
    '选题建议': '基于我的账号数据，帮我推荐5个选题方向',
    '导出结果': '请帮我导出上次生成的物料',
    '拍摄清单': '请为以下脚本生成拍摄清单：\n\n',
    '字幕稿': '请为以下口播稿生成 SRT 字幕：\n\n',
    '标题优化': '请帮我优化以下标题，适合多平台发布：\n\n',
    '竞品分析': '请分析以下竞品账号的内容策略：\n\n',
    '创作灵感': '帮我 brainstorm 一些创作灵感，我是做',
  }
  setInput(prev => {
    const template = templates[action] || ''
    return prev ? template + prev : template
  })
  textareaRef.current?.focus()
}
```

**e) 消息操作栏（始终显示）**：

```tsx
{/* 助手消息操作栏 */}
{msg.role === 'assistant' && msg.content && (
  <div className="flex items-center gap-0.5 mt-2">
    <button onClick={() => handleFeedback(msg.id, 'good')} className="msg-action-btn" title="有帮助">
      <span className="material-symbols-outlined text-[14px]">thumb_up</span>
    </button>
    <button onClick={() => handleFeedback(msg.id, 'bad')} className="msg-action-btn" title="没帮助">
      <span className="material-symbols-outlined text-[14px]">thumb_down</span>
    </button>
    <button onClick={() => handleCopy(msg.id, msg.content)} className="msg-action-btn" title="复制">
      <span className="material-symbols-outlined text-[14px]">{copiedId === msg.id ? 'check' : 'content_copy'}</span>
    </button>
    <button onClick={() => handleExport(msg)} className="msg-action-btn" title="导出">
      <span className="material-symbols-outlined text-[14px]">ios_share</span>
    </button>
    <button onClick={() => handleRegenerate(msg)} className="msg-action-btn" title="重新生成">
      <span className="material-symbols-outlined text-[14px]">refresh</span>
    </button>
  </div>
)}
```

**f) 反馈展开面板**：

```tsx
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
```

**g) Canvas 侧边面板**：

```tsx
const [canvasOpen, setCanvasOpen] = useState(false)
const [canvasData, setCanvasData] = useState<MaterialData | null>(null)

const openCanvas = (data: MaterialData) => {
  setCanvasData(data)
  setCanvasOpen(true)
}

// 在主内容区
<div className="flex flex-1 overflow-hidden">
  {/* 对话区域 */}
  <div className={`flex-1 flex flex-col overflow-hidden transition-all ${canvasOpen ? 'max-w-[calc(100%-420px)]' : ''}`}>
    {/* ... 现有对话内容 ... */}
  </div>

  {/* Canvas 面板 */}
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
      <div className="flex-1 overflow-y-auto">
        {canvasData && <MaterialPanel data={canvasData} />}
      </div>
      <div className="px-4 py-3 border-t border-outline-variant/30 flex gap-2">
        <button onClick={handleCopyAll} className="flex-1 py-2 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors">
          📋 复制全部
        </button>
        <button onClick={handleExportAll} className="flex-1 py-2 bg-surface-container border border-outline-variant text-on-surface text-xs rounded-lg hover:bg-surface-high transition-colors">
          📤 导出
        </button>
      </div>
    </div>
  )}
</div>
```

在工具调用卡片和消息操作栏中增加"在面板查看"按钮：

```tsx
{msg.materialData && (
  <button onClick={() => openCanvas(msg.materialData!)} className="msg-action-btn" title="在面板查看">
    <span className="material-symbols-outlined text-[14px]">dashboard</span>
  </button>
)}
```

### index.css 新增样式

```css
/* 快捷操作按钮 */
.quick-action {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-[11px] shrink-0;
  @apply bg-surface-container/50 text-on-surface-variant hover:bg-surface-container hover:text-on-surface;
}

/* 消息操作栏按钮 */
.msg-action-btn {
  @apply p-1.5 rounded-md text-mute hover:text-on-surface hover:bg-surface-container transition-colors;
}

/* Canvas 面板过渡 */
.canvas-panel {
  @apply border-l border-outline-variant bg-surface-low flex flex-col;
  transition: width 0.25s ease-in-out;
}
```

---

## 验收标准

### 输入框

- [ ] 输入框下方显示快捷操作栏：生成物料、分析数据、选题建议、导出结果
- [ ] 点击快捷按钮，输入框预填对应 prompt 模板
- [ ] 输入框有内容时，点击快捷按钮在内容前追加指令
- [ ] 右侧 ➕ 按钮展开更多操作菜单（拍摄清单、字幕稿、标题优化、竞品分析、创作灵感）
- [ ] 左侧 📎 按钮支持文件导入

### 消息操作栏

- [ ] 每条助手消息下方始终显示操作栏（👍 👎 📋 📤 🔄）
- [ ] 点击 👎 展开反馈面板，选择原因后记录
- [ ] 复制按钮显示 toast 反馈
- [ ] 重新生成按钮重新发送上一条消息

### Canvas 面板

- [ ] 工具调用卡片有"在面板查看"按钮
- [ ] 消息操作栏有面板查看按钮（仅当消息包含物料时）
- [ ] 点击后面板从右侧滑出，宽度 420px
- [ ] 面板内显示完整的物料 tab 切换 + 字段展示
- [ ] 面板底部有"复制全部"和"导出"按钮
- [ ] 关闭面板后对话区域恢复全宽

### 欢迎页

- [ ] 建议标签散落式排列（非网格）
- [ ] 点击标签预填到输入框
- [ ] 输入框下方显示快捷操作栏

---

---

## 附录：新功能实现细节（下拉菜单中的 5 个功能）

> 以下是下拉菜单中每个功能的具体实现方案。这些功能目前不存在，需要新增。

---

### F1：拍摄清单

**用途**：用户输入脚本，AI 生成分镜拍摄清单（景别、内容、时长、备注）。

**实现方式**：不需要新增 Agent 工具。利用现有 Agent 的自由对话模式，在 prompt 中明确要求只输出拍摄清单，不走 analyze_script → expand_script 全流程。

**prefill prompt 模板**：

```
请为以下脚本生成拍摄清单，只需要拍摄清单，不需要其他平台物料。

要求：
- 具体到景别（特写/中景/全景/俯拍/跟拍/空镜）
- 标注每个镜头的预估时长
- 按拍摄顺序排列
- 标注需要的道具和场地
- 输出为表格格式

脚本内容：
```

**Agent 行为**：Agent 收到这个 prompt 后，因为明确说了"不需要其他平台物料"，应该走自由对话模式，直接输出拍摄清单表格。不需要调用任何工具。

**输出格式**（Agent 应该输出的）：

```
| # | 景别 | 拍摄内容 | 预估时长 | 道具/场地 | 备注 |
|---|------|---------|---------|----------|------|
| 1 | 全景 | 开场，站在产品前打招呼 | 3s | 桌面/产品 | 自然光 |
| 2 | 特写 | 产品外观细节 | 5s | 产品 | 微距镜头 |
| ... |
```

**需要改动**：
- 无代码改动，纯 prompt 模板
- 确保 Agent 系统提示词（已改为自由对话模式）不会把这种请求当脚本处理

---

### F2：字幕稿

**用途**：用户输入口播稿文本，AI 生成 SRT 格式字幕文件。

**实现方式**：prompt 模板 + Agent 自由对话输出。不需要新工具。

**prefill prompt 模板**：

```
请为以下口播稿生成 SRT 格式的字幕文件。

要求：
- 标准 SRT 格式（序号 + 时间码 + 字幕文本）
- 中文语速按每秒 3-4 个字估算
- 每条字幕不超过 20 个字（方便手机观看）
- 在自然断句处分割（逗号、句号、换行处）
- 时间码格式：HH:MM:SS,mmm

口播稿内容：
```

**Agent 行为**：走自由对话模式，直接输出 SRT 文本。

**输出格式**：

```
1
00:00:01,000 --> 00:00:03,500
今天给大家带来华为Mate 70 Pro

2
00:00:03,800 --> 00:00:06,200
的深度体验报告

3
00:00:06,500 --> 00:00:09,000
先说外观，这次采用了全新的玄武架构
```

**需要改动**：
- 无代码改动，纯 prompt 模板

---

### F3：标题优化

**用途**：用户输入一个标题或脚本，AI 为四个平台分别生成优化后的标题。

**实现方式**：prompt 模板 + Agent 自由对话输出。

**prefill prompt 模板**：

```
请为以下内容生成四个平台的优化标题。

要求：
- B站：≤80字，专业感+信息量，突出核心卖点
- YouTube：≤60字符，SEO友好，前置关键词，英文
- 抖音：≤55字，口语化，制造悬念或冲突
- 小红书：≤20字，带emoji，像朋友聊天

每个平台给 3 个标题选项，标注推荐的那个。

内容：
```

**Agent 行为**：走自由对话模式，输出结构化的标题建议。

**输出格式**：

```
## B站

1. **[推荐]** 华为Mate70 Pro深度体验：玄武架构到底提升了什么？
2. 华为Mate70 Pro一个月使用报告，这3个升级最值
3. 6499值不值？华为Mate70 Pro完整评测

## YouTube

1. **[推荐]** Huawei Mate 70 Pro Review: 3 Upgrades Worth the Price
2. Huawei Mate 70 Pro - 1 Month Later, Here's the Truth
3. Is the Huawei Mate 70 Pro Worth ¥6499? Full Review

## 抖音

1. **[推荐]** 华为Mate70 Pro用了一个月，这功能让我直接放弃iPhone
2. 6499买的华为新旗舰，到底值不值？
3. 华为Mate70 Pro最被低估的一个功能，99%的人不知道

## 小红书

1. **[推荐]** 华为Mate70 Pro一个月真实体验🫢真的回不去了
2. 姐妹们！华为新手机这个功能绝了🔥
3. 华为Mate70 Pro深度使用报告📝优缺点全说
```

**需要改动**：
- 无代码改动，纯 prompt 模板

---

### F4：竞品分析

**用途**：用户输入一个创作者 UID 或关键词，AI 基于已爬取的数据分析竞品策略。

**实现方式**：prompt 模板 + 查询数据库中的爬取数据 + Agent 自由对话输出。

**prefill prompt 模板**：

```
请分析以下创作者/关键词的内容策略。

先查询该来源的历史数据，然后分析：
1. 内容定位和风格特征
2. 高互动内容的共性（标题规律、选题方向）
3. 发布频率和时间规律
4. 值得学习的 3 个策略
5. 可以差异化的 3 个方向

创作者/关键词：
```

**需要的代码改动**：

a) `knower-agent/db/index.js` 新增查询函数：

```javascript
async function getSourceDetail(sourceUid, platform) {
  const db = await getDb()
  const res = db.exec(
    `SELECT title, "desc", like_count, comment_count, play_count, share_count, created_at, category, raw_json
     FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY play_count DESC LIMIT 30`,
    [sourceUid, platform || 'bili']
  )
  if (!res.length) return []
  return res[0].values.map(row => {
    let raw = {}
    try { raw = JSON.parse(row[8] || '{}') } catch {}
    return {
      title: row[0], desc: row[1], likeCount: row[2], commentCount: row[3],
      playCount: row[4], shareCount: row[5], createdAt: row[6], category: row[7],
      coinCount: parseInt(raw.video_coin_count) || 0,
      favoriteCount: parseInt(raw.video_favorite_count) || 0,
    }
  })
}
```

b) `electron/main.ts` 新增 IPC handler：

```typescript
ipcMain.handle('source-detail', async (_event, sourceUid: string, platform?: string) => {
  return await db.getSourceDetail(sourceUid, platform)
})
```

c) `electron/preload.ts` 新增：

```typescript
getSourceDetail: (sourceUid: string, platform?: string) => ipcRenderer.invoke('source-detail', sourceUid, platform),
```

d) Agent 系统提示词中增加指引：当用户提到创作者 UID 或竞品分析时，先调用 IPC 查询数据，再基于数据回答。

**实现路径**：在 `agent-run` handler 中，检测 prompt 中是否包含 UID（纯数字），如果包含则自动查询数据注入到 prompt 中：

```typescript
// 检测是否包含 UID
const uidMatch = prompt.match(/\b(\d{6,12})\b/)
if (uidMatch) {
  const uid = uidMatch[1]
  const detail = await db.getSourceDetail(uid)
  if (detail.length > 0) {
    const dataStr = detail.map((v, i) =>
      `${i+1}. "${v.title}" | 播放:${v.playCount} | 点赞:${v.likeCount} | 评论:${v.commentCount}`
    ).join('\n')
    prompt = `## 该创作者的历史数据（共 ${detail.length} 条）\n${dataStr}\n\n## 任务\n${prompt}`
  }
}
```

---

### F5：创作灵感

**用途**：用户输入自己的创作方向/领域，AI brainstorm 一批选题创意。

**实现方式**：prompt 模板 + 查询 memories 表中的用户偏好 + Agent 自由对话输出。

**prefill prompt 模板**：

```
帮我 brainstorm 一些创作灵感。

要求：
- 给出 8-10 个选题方向
- 每个包含：选题标题、内容角度、预估吸引力（高/中/低）、适合平台
- 结合当前趋势和用户的历史偏好
- 覆盖不同类型：教程类、测评类、观点类、故事类
- 标注哪些适合做系列内容

我的创作方向：
```

**需要的代码改动**：

a) `buildSystemPrompt()` 已经注入了 memories，Agent 能看到用户的风格偏好。

b) 如果用户有爬取数据，在 `agent-run` handler 中自动注入近期趋势数据（和 F4 类似）。

**不需要额外代码**，纯 prompt 模板 + 已有的记忆注入机制。

---

### 快捷操作按钮与功能的映射总结

| 按钮 | 功能 | 需要新代码？ | 实现方式 |
|---|---|---|---|
| 生成物料 | 已有功能 | 否 | 走 analyze_script → expand_script → save_result |
| 分析数据 | 已有功能 | 否 | 走 DataView 的 AI 分析 |
| 选题建议 | 已有功能 | 部分 | 需要 suggest_topics 工具（M3 阶段） |
| 导出结果 | 新功能 | 小改动 | 查询最近一次 save_result 的结果，输出格式化文本 |
| 拍摄清单 | 新功能 | 否 | prompt 模板，Agent 自由对话输出 |
| 字幕稿 | 新功能 | 否 | prompt 模板，Agent 自由对话输出 |
| 标题优化 | 新功能 | 否 | prompt 模板，Agent 自由对话输出 |
| 竞品分析 | 新功能 | 是 | 新增 IPC + DB 查询 + UID 自动检测 |
| 创作灵感 | 新功能 | 否 | prompt 模板 + 已有记忆注入 |

### 优先级

| 优先级 | 功能 | 原因 |
|---|---|---|
| P0 | 拍摄清单、字幕稿、标题优化 | 纯 prompt 模板，零代码改动，立即可用 |
| P1 | 创作灵感 | 依赖记忆注入，已部分实现 |
| P2 | 竞品分析 | 需要新增 IPC + DB 查询代码 |
| P3 | 导出结果 | 需要查询最近生成记录 |

---

*知更 Knower · 创作台交互重设计提示词 v1.1*
