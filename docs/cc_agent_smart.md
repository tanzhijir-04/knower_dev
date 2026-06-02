# 给 CC 的提示词：Agent 智能交互 — 意图识别 + 表单弹窗

## 背景

当前 Agent 只能处理脚本分析，用户说"帮我分析B站UP主"它会当脚本处理。需要两个能力：
1. **意图识别**：Agent 能理解用户想做什么（分析UP主、生成物料、选题建议等）
2. **交互式表单**：当 Agent 需要更多信息时，弹出表单让用户填写，而不是纯文字追问

## 架构设计

采用**两层方案**：

### 第一层：前端意图预检测（简单场景）

用户输入消息后，在发送给 Agent 之前，前端检测常见意图模式。如果匹配到需要额外信息的意图，先弹表单，用户填完后构造完整 prompt 再发给 Agent。

```
用户输入 "分析B站UP主"
→ 前端检测到意图：分析创作者
→ 需要信息：平台、UID/用户名
→ 弹出表单
→ 用户填写：平台=B站, UID=440609243
→ 构造 prompt: "请帮我分析B站UP主，UID: 440609243，爬取数据并给出分析报告"
→ 发送给 Agent
→ Agent 正常处理
```

### 第二层：Agent 工具触发表单（复杂场景）

当 Agent 在对话过程中发现需要更多信息时，调用 `request_user_input` 工具，前端收到后弹表单。用户填完后开启新一轮对话。

```
Agent 处理中发现需要确认
→ 调用 request_user_input 工具
→ 前端弹出表单
→ 用户填写并提交
→ 前端自动发送新消息（包含表单数据 + 上下文）
→ Agent 继续处理
```

---

## 第一层：前端意图预检测

### 改动文件

1. `src/components/ChatView.tsx`（新增意图检测逻辑 + 表单弹窗）

### 意图模式定义

在 ChatView.tsx 中新增：

```tsx
interface IntentPattern {
  id: string
  name: string
  icon: string
  // 匹配关键词（任意一个命中即可）
  keywords: string[]
  // 需要用户填写的字段
  fields: FormField[]
  // prompt 模板，{field.name} 会被替换为用户填写的值
  promptTemplate: string
}

interface FormField {
  name: string
  label: string
  type: 'text' | 'select' | 'textarea'
  options?: string[]        // select 类型的选项
  required?: boolean
  placeholder?: string
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    id: 'analyze_creator',
    name: '分析创作者',
    icon: 'person_search',
    keywords: ['分析UP主', '分析创作者', '分析博主', '看看这个UP', '分析一下.*的账号', '爬取.*数据'],
    fields: [
      { name: 'platform', label: '平台', type: 'select', options: ['B站', '抖音', '小红书', '微博'], required: true },
      { name: 'uid', label: '用户 UID / 主页链接', type: 'text', required: true, placeholder: '如 B站的 UID：440609243' },
    ],
    promptTemplate: '请帮我爬取{platform}创作者的数据（UID: {uid}），然后分析这个创作者的内容策略、高互动内容特征、选题方向，并给出我可以学习的建议。',
  },
  {
    id: 'generate_material',
    name: '生成物料',
    icon: 'auto_awesome',
    keywords: ['生成物料', '生成.*平台', '帮我写标题', '生成B站', '生成抖音', '生成小红书'],
    fields: [
      { name: 'platforms', label: '目标平台', type: 'select', options: ['B站 + 抖音 + 小红书', 'B站 + YouTube + 抖音 + 小红书', '仅B站', '仅抖音', '仅小红书'], required: true },
      { name: 'script', label: '脚本内容', type: 'textarea', required: true, placeholder: '粘贴你的视频脚本...' },
    ],
    promptTemplate: '请帮我分析以下脚本，并为{platforms}生成发布物料：\n\n{script}',
  },
  {
    id: 'title_optimize',
    name: '标题优化',
    icon: 'title',
    keywords: ['优化标题', '标题不好', '帮我改标题', '换个标题'],
    fields: [
      { name: 'originalTitle', label: '当前标题', type: 'text', required: true },
      { name: 'platforms', label: '目标平台', type: 'select', options: ['B站 + YouTube + 抖音 + 小红书', '仅B站', '仅抖音', '仅小红书'], required: true },
    ],
    promptTemplate: '请帮我优化以下标题，为{platforms}各生成 3 个选项并标注推荐。\n\n当前标题：{originalTitle}',
  },
  {
    id: 'brainstorm',
    name: '创作灵感',
    icon: 'tips_and_updates',
    keywords: ['创作灵感', '选题建议', '帮我想想', 'brainstorm', '做什么内容', '推荐选题'],
    fields: [
      { name: 'niche', label: '你的创作方向/领域', type: 'text', required: true, placeholder: '如：科技数码、生活Vlog、美食...' },
      { name: 'count', label: '需要几个选题', type: 'select', options: ['5个', '8个', '10个'], required: true },
    ],
    promptTemplate: '帮我 brainstorm {count}个创作灵感。我是做{niche}方向的。要求：覆盖教程类、测评类、观点类、故事类，每个包含选题标题、内容角度、预估吸引力、适合平台。',
  },
]
```

### 意图检测函数

```tsx
function detectIntent(input: string): IntentPattern | null {
  const normalized = input.trim().toLowerCase()
  for (const pattern of INTENT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (new RegExp(keyword, 'i').test(normalized)) {
        return pattern
      }
    }
  }
  return null
}
```

### 表单弹窗组件

```tsx
function IntentFormModal({ pattern, onSubmit, onClose }: {
  pattern: IntentPattern
  onSubmit: (data: Record<string, string>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    for (const field of pattern.fields) {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label}不能为空`
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-low border border-outline-variant rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[20px]">{pattern.icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface">{pattern.name}</h3>
            <p className="text-[11px] text-mute">请填写以下信息</p>
          </div>
          <button onClick={onClose} className="ml-auto text-mute hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 表单字段 */}
        <div className="space-y-4 mb-6">
          {pattern.fields.map(field => (
            <div key={field.name}>
              <label className="block text-xs text-on-surface-variant mb-1.5">{field.label}</label>
              {field.type === 'text' && (
                <input
                  value={formData[field.name] || ''}
                  onChange={(e) => { setFormData({ ...formData, [field.name]: e.target.value }); setErrors({ ...errors, [field.name]: '' }) }}
                  placeholder={field.placeholder}
                  className={`w-full bg-surface-container border ${errors[field.name] ? 'border-red-400' : 'border-outline-variant/30'} rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-mute`}
                />
              )}
              {field.type === 'select' && (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => { setFormData({ ...formData, [field.name]: e.target.value }); setErrors({ ...errors, [field.name]: '' }) }}
                  className={`w-full bg-surface-container border ${errors[field.name] ? 'border-red-400' : 'border-outline-variant/30'} rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer`}
                >
                  <option value="">请选择...</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              {field.type === 'textarea' && (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => { setFormData({ ...formData, [field.name]: e.target.value }); setErrors({ ...errors, [field.name]: '' }) }}
                  placeholder={field.placeholder}
                  rows={4}
                  className={`w-full bg-surface-container border ${errors[field.name] ? 'border-red-400' : 'border-outline-variant/30'} rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-mute resize-none`}
                />
              )}
              {errors[field.name] && <p className="text-[10px] text-red-400 mt-1">{errors[field.name]}</p>}
            </div>
          ))}
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-surface-container border border-outline-variant text-on-surface text-sm rounded-xl hover:bg-surface-high transition-colors">
            取消
          </button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 bg-primary/20 text-primary text-sm font-medium rounded-xl hover:bg-primary/30 transition-colors">
            确认并执行
          </button>
        </div>
      </div>
    </div>
  )
}
```

### ChatView 中的集成

```tsx
// 新增状态
const [pendingIntent, setPendingIntent] = useState<IntentPattern | null>(null)

// 修改 handleSend
const handleSend = async () => {
  if (!input.trim() || isStreaming) return

  const userContent = input.trim()

  // 意图检测
  const intent = detectIntent(userContent)
  if (intent) {
    // 检查是否所有必填字段都能从输入中自动提取
    // 如果不能，弹表单
    setPendingIntent(intent)
    return  // 暂不发送，等表单提交
  }

  // 正常发送
  doSendMessage(userContent)
}

// 表单提交
const handleIntentSubmit = (data: Record<string, string>) => {
  if (!pendingIntent) return

  // 用表单数据填充 prompt 模板
  let prompt = pendingIntent.promptTemplate
  for (const [key, value] of Object.entries(data)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }

  setPendingIntent(null)
  doSendMessage(prompt)
}

// 抽取发送逻辑
const doSendMessage = async (content: string) => {
  // ... 现有的发送逻辑 ...
}
```

### 表单弹窗渲染

```tsx
{/* 在 return 的最外层 */}
{pendingIntent && (
  <IntentFormModal
    pattern={pendingIntent}
    onSubmit={handleIntentSubmit}
    onClose={() => setPendingIntent(null)}
  />
)}
```

---

## 第二层：Agent 工具触发表单

用于 Agent 在对话过程中需要更多信息的场景。

### 改动文件

1. `knower-agent/agent/tools/request_user_input.js`（新工具）
2. `knower-agent/agent/tools/index.js`（注册）
3. `electron/main.ts`（新增 IPC handler）
4. `electron/preload.ts`（暴露 API）
5. `src/components/ChatView.tsx`（处理表单事件）

### 工具定义

```javascript
// knower-agent/agent/tools/request_user_input.js

let _formResolver = null

module.exports = {
  name: 'request_user_input',
  description: '当需要用户确认或补充信息时调用。定义表单字段，前端会弹出表单让用户填写。',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: '向用户展示的说明文字' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '字段名（英文）' },
            label: { type: 'string', description: '显示给用户的字段标签' },
            type: { type: 'string', enum: ['text', 'select'], description: '字段类型' },
            options: { type: 'array', items: { type: 'string' }, description: 'select 类型的选项' },
            required: { type: 'boolean' },
            placeholder: { type: 'string' },
          },
          required: ['name', 'label', 'type'],
        },
      },
    },
    required: ['message', 'fields'],
  },
  async execute(input) {
    // 返回表单请求，前端会处理
    // 返回后 Agent 的 stream 循环会继续，但这个工具的结果会被前端拦截
    return {
      formRequest: true,
      message: input.message,
      fields: input.fields,
    }
  },
  // 静态方法：供外部 resolve 等待中的表单
  resolveForm(data) {
    if (_formResolver) {
      _formResolver(data)
      _formResolver = true  // 标记已解决
    }
  },
  // 静态方法：创建等待 Promise
  waitForForm() {
    return new Promise((resolve) => {
      _formResolver = resolve
    })
  },
  isWaiting() {
    return _formResolver === true ? false : !!_formResolver
  },
}
```

### ChatView 处理表单请求

在 `onAgentEvent` 监听中新增：

```typescript
if (event.type === 'tool_call' && event.name === 'request_user_input') {
  // Agent 请求用户输入，弹出表单
  setPendingAgentForm({
    message: event.input.message,
    fields: event.input.fields,
  })
  // 暂停流式显示
  setStatus('等待用户输入...')
}

if (event.type === 'agent_form_result') {
  // 表单已提交，Agent 继续处理
  setPendingAgentForm(null)
  setStatus('正在处理...')
}
```

### 表单提交流程

```tsx
// Agent 工具触发的表单
const [pendingAgentForm, setPendingAgentForm] = useState<{
  message: string
  fields: { name: string; label: string; type: string; options?: string[]; placeholder?: string }[]
} | null>(null)

const handleAgentFormSubmit = async (data: Record<string, string>) => {
  // 1. 通过 IPC 提交给 Agent
  await window.electronAPI?.submitAgentForm(data)

  // 2. 在对话中显示用户填写的内容
  const formSummary = Object.entries(data)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
  setMessages(prev => [...prev, {
    id: Date.now().toString(),
    role: 'user',
    content: `[表单回复] ${formSummary}`,
  }])

  setPendingAgentForm(null)
  setStatus('正在处理...')
}
```

### 渲染 Agent 表单弹窗

```tsx
{pendingAgentForm && (
  <IntentFormModal
    pattern={{
      id: 'agent_request',
      name: '需要补充信息',
      icon: 'info',
      fields: pendingAgentForm.fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type as 'text' | 'select',
        options: f.options,
        placeholder: f.placeholder,
        required: true,
      })),
    }}
    onSubmit={handleAgentFormSubmit}
    onClose={() => setPendingAgentForm(null)}
  />
)}
```

---

## 改动清单

| 文件 | 改动 |
|---|---|
| `src/components/ChatView.tsx` | 新增意图检测、表单弹窗、Agent 表单处理 |
| `knower-agent/agent/tools/request_user_input.js` | 新建 |
| `knower-agent/agent/tools/index.js` | 注册新工具 |
| `electron/main.ts` | 新增 `agent-submit-form` IPC handler |
| `electron/preload.ts` | 暴露 `submitAgentForm` |

---

## 验收标准

### 第一层（意图预检测）

- [ ] 输入"分析B站UP主"→ 弹出表单（平台选择 + UID 输入）
- [ ] 输入"帮我生成物料"→ 弹出表单（平台选择 + 脚本输入）
- [ ] 输入"优化标题"→ 弹出表单（当前标题 + 平台选择）
- [ ] 输入"创作灵感"→ 弹出表单（创作方向 + 数量选择）
- [ ] 表单有必填校验，空值提交时显示红色提示
- [ ] 表单提交后自动构造完整 prompt 发送给 Agent
- [ ] 不匹配任何意图时，正常发送给 Agent（自由对话）

### 第二层（Agent 工具）

- [ ] Agent 在对话中调用 `request_user_input` 时，前端弹出表单
- [ ] 表单填写并提交后，Agent 能继续处理
- [ ] 提交的内容在对话中以用户消息形式显示

---

*知更 Knower · Agent 智能交互提示词*
