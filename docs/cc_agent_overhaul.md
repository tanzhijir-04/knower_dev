# 给 CC 的提示词：Agent 全面智能化改造

## 背景

当前 Agent 有几个致命问题：
1. 系统提示词硬编码了"脚本分析"流程，所有输入都走 analyze → expand → save
2. 只有 1 个工具（save_result），无法爬取数据、查询数据、与用户交互
3. 无法理解用户意图，不能根据场景选择不同工作流
4. 用户说"帮我分析B站UP主"它会当脚本处理

**目标**：让 Agent 成为一个真正的智能助手，能理解意图、自主规划、调用工具、与用户交互。

---

## 改造总览

| 改动 | 说明 |
|---|---|
| 重写系统提示词 | 从"脚本处理器"改为"意图感知的通用助手" |
| 新增 4 个工具 | crawl_data、query_data、request_user_input、save_result（已有） |
| 改造 Agent 工具执行 | 工具可以访问数据库和爬虫 |
| 前端表单交互 | 支持 Agent 工具触发的表单弹窗 |

---

## 一、重写系统提示词

### 改动文件

`knower-agent/agent/core.js` — 替换 `BASE_SYSTEM_PROMPT`（第 5-103 行）

### 新的系统提示词

```javascript
const BASE_SYSTEM_PROMPT = `你是知更 AI，一个专为中文视频创作者服务的智能助手。你能帮助创作者完成从选题到发布的全流程工作。

## 你的能力

你可以调用以下工具来完成任务：

1. **crawl_data** — 爬取平台公开数据（B站/抖音/小红书/微博的创作者主页或关键词搜索结果）
2. **query_data** — 查询用户已有的爬取数据
3. **save_result** — 将生成的物料保存到本地数据库
4. **request_user_input** — 当你需要更多信息时，向用户弹出表单请求输入

## 工作原则

### 1. 意图识别

收到用户消息后，先判断意图，再决定行动：

| 意图 | 判断依据 | 行动 |
|---|---|---|
| **分析创作者** | 提到"分析UP主/创作者/博主/账号" + 平台名或UID | 先确认信息是否完整，缺失则 request_user_input，然后 crawl_data → 分析 |
| **生成物料** | 提到"生成物料/脚本/标题/文案" + 有脚本内容 | 直接生成各平台物料，调用 save_result 保存 |
| **生成字幕** | 提到"字幕/SRT/字幕稿" | 直接生成 SRT 格式字幕 |
| **标题优化** | 提到"优化标题/改标题/换个标题" | 生成多平台标题选项 |
| **创作灵感** | 提到"选题/灵感/brainstorm/做什么" | 基于用户方向生成选题建议 |
| **查看数据** | 提到"看看我的数据/已爬取的数据" | 调用 query_data 查询 |
| **闲聊** | 以上都不匹配 | 自由对话，像朋友一样交流 |

### 2. 信息完整性检查

执行任务前，检查是否有所需信息：

- **分析创作者**：需要平台 + UID 或关键词。如果用户只说了"分析B站UP主"但没给 UID，调用 request_user_input 请求
- **生成物料**：需要脚本内容。如果用户只说了"帮我生成物料"但没给脚本，调用 request_user_input 请求
- **其他任务**：通常信息已足够，直接执行

### 3. 工具调用规则

- 分析创作者时，**必须先 crawl_data 获取数据**，再基于数据分析，不要编造数据
- 数据分析结果要具体引用数据（如"该UP主平均播放量 2.3 万"），不要泛泛而谈
- 生成物料时，每个平台的标题/简介/标签要符合平台规范（字数限制、调性）
- 保存结果时调用 save_result，让数据沉淀到知识库

### 4. 回复风格

- 口语化、有温度，像一个懂创作的朋友
- 分析类回复要**数据驱动**，引用具体数字
- 物料类回复要**实用可执行**，用户能直接复制使用
- 不要用 Markdown 表格展示物料（用户可能直接复制），用清晰的分段格式
- 回复简洁有力，不要废话

## 各平台规范

### B站
- 标题：≤80字，专业感+信息量，极客调性
- 描述：≤200字，包含关键信息点
- 标签：5-8个，混合热门+精准

### YouTube
- 标题：≤60字符，SEO友好，前置关键词
- 描述：前两行最关键，含时间戳
- 标签：5-15个，中英混合

### 抖音
- 标题：≤55字，口语化有冲击力
- 前3秒钩子：必须制造好奇/冲突/反转
- 标签：3-5个，偏口语化

### 小红书
- 标题：≤20字，必须带emoji
- 正文：口语化、像朋友聊天
- 标签：5-8个，偏生活化`
```

---

## 二、新增工具

### 工具 1：crawl_data（爬取数据）

**文件**：`knower-agent/agent/tools/crawl_data.js`（新建）

```javascript
const { runCrawler } = require('../../lib/crawler')

module.exports = {
  name: 'crawl_data',
  description: '爬取指定平台的公开数据。支持按关键词搜索或爬取创作者主页。',
  input_schema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['bili', 'dy', 'xhs', 'wb'],
        description: '平台：bili=B站, dy=抖音, xhs=小红书, wb=微博',
      },
      keyword: {
        type: 'string',
        description: '搜索关键词（关键词搜索模式时使用）',
      },
      creatorUid: {
        type: 'string',
        description: '创作者 UID（创作者主页模式时使用）',
      },
      maxNotes: {
        type: 'number',
        description: '最大爬取数量，默认 15',
      },
    },
    required: ['platform'],
  },
  async execute({ platform, keyword, creatorUid, maxNotes }) {
    const options = { maxNotes: maxNotes || 15 }

    if (creatorUid) {
      options.crawlerType = 'creator'
      options.creatorId = creatorUid
    } else if (keyword) {
      options.crawlerType = 'search'
    } else {
      return { error: '请提供 keyword 或 creatorUid' }
    }

    try {
      const result = await runCrawler(platform, keyword || '', options)
      return {
        success: true,
        platform,
        totalCount: result.stats?.total_contents || 0,
        creators: result.creators?.map(c => ({
          nickname: c.nickname,
          userId: c.user_id,
          fans: c.total_fans,
        })) || [],
        topContents: (result.contents || []).slice(0, 10).map(c => ({
          title: c.title,
          playCount: c.video_play_count || c.play_count || 0,
          likeCount: c.liked_count || 0,
          commentCount: c.video_comment || c.comment_count || 0,
        })),
        message: `成功爬取 ${result.stats?.total_contents || 0} 条数据`,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}
```

### 工具 2：query_data（查询数据）

**文件**：`knower-agent/agent/tools/query_data.js`（新建）

```javascript
const { getSourceList, getVideosBySource, getAllCrawlContent } = require('../../db')

module.exports = {
  name: 'query_data',
  description: '查询用户已有的爬取数据。可以按来源查询，也可以查询全部。',
  input_schema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['bili', 'dy', 'xhs', 'wb', 'all'],
        description: '平台，all 表示所有平台',
      },
      sourceUid: {
        type: 'string',
        description: '来源 UID（可选，不填则查全部）',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 20',
      },
    },
  },
  async execute({ platform, sourceUid, limit }) {
    try {
      if (sourceUid) {
        const videos = await getVideosBySource(platform || 'bili', sourceUid)
        return {
          success: true,
          sourceUid,
          totalCount: videos.length,
          videos: videos.slice(0, limit || 20).map(v => ({
            title: v.title,
            playCount: v.playCount,
            likeCount: v.likeCount,
            commentCount: v.commentCount,
            category: v.category,
          })),
        }
      } else {
        const sources = await getSourceList(platform === 'all' ? null : platform)
        return {
          success: true,
          sources: sources.map(s => ({
            name: s.sourceName,
            uid: s.sourceUid,
            type: s.type,
            count: s.count,
          })),
          totalSources: sources.length,
        }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}
```

### 工具 3：request_user_input（交互式表单）

**文件**：`knower-agent/agent/tools/request_user_input.js`（新建）

```javascript
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
            name: { type: 'string', description: '字段名（英文key）' },
            label: { type: 'string', description: '显示给用户的字段标签' },
            type: { type: 'string', enum: ['text', 'select'], description: '字段类型' },
            options: { type: 'array', items: { type: 'string' }, description: 'select 的选项' },
            placeholder: { type: 'string' },
            required: { type: 'boolean' },
          },
          required: ['name', 'label', 'type'],
        },
      },
    },
    required: ['message', 'fields'],
  },
  async execute(input) {
    // 返回表单请求标记，前端会拦截并渲染表单
    return {
      formRequest: true,
      message: input.message,
      fields: input.fields,
    }
  },
}
```

### 工具 4：save_result（已有，无需改动）

现有实现已满足需求。

---

## 三、注册新工具

### 改动文件

`knower-agent/agent/tools/index.js`

```javascript
const saveResult = require('./save_result')
const crawlData = require('./crawl_data')
const queryData = require('./query_data')
const requestUserInput = require('./request_user_input')

const tools = [saveResult, crawlData, queryData, requestUserInput]

module.exports = { tools }
```

---

## 四、Agent 工具执行改造

### 改动文件

`knower-agent/agent/core.js`

**a) 修改工具执行，传递 context**：

在 `stream()` 方法中，找到工具执行的部分（约第 170-190 行），修改为：

```javascript
// 旧
const tool = tools.find((t) => t.name === block.name)
let result
if (tool) {
  try {
    result = await tool.execute(input)
  } catch (err) {
    result = { error: err.message }
  }
}

// 新 - 传递 onToolResult 回调
const tool = tools.find((t) => t.name === block.name)
let result
if (tool) {
  try {
    result = await tool.execute(input)
    // 如果是 request_user_input，通知前端弹表单
    if (result.formRequest) {
      yield { type: 'form_request', message: result.message, fields: result.fields }
    }
  } catch (err) {
    result = { error: err.message }
  }
}
```

同样修改 `run()` 方法中的工具执行。

**b) 修改 stream 方法签名，支持 form 回调**：

```javascript
async *stream(userInput, options = {}) {
  const { platforms = ['bilibili', 'douyin', 'xiaohongshu'], signal } = options
  // ... 现有代码 ...

  // 新增：支持外部注入表单结果
  let pendingFormResolve = null

  // 在外部提供 resolve 方法
  this._resolveForm = (data) => {
    if (pendingFormResolve) {
      pendingFormResolve(data)
      pendingFormResolve = null
    }
  }
```

**c) 工具执行中等待表单**：

```javascript
// 如果是 request_user_input，等待用户提交
if (result.formRequest) {
  const formData = await new Promise((resolve) => {
    pendingFormResolve = resolve
  })
  result = { success: true, data: formData }
}
```

---

## 五、IPC 层改造

### 改动文件

`electron/main.ts`

**a) 新增表单提交 IPC**：

```typescript
// Agent 表单提交
let currentAgent: any = null

ipcMain.handle('agent-run', async (event, script: string, platforms: string[]) => {
  // ... 现有代码 ...
  const agent = new Agent(config)
  currentAgent = agent  // 保存引用

  // ... stream 循环 ...
})

ipcMain.handle('agent-submit-form', async (_event, data: Record<string, string>) => {
  if (currentAgent?._resolveForm) {
    currentAgent._resolveForm(data)
    return true
  }
  return false
})
```

**b) 新增数据查询 IPC**（供前端直接调用）：

```typescript
ipcMain.handle('query-data', async (_event, platform?: string, sourceUid?: string) => {
  if (sourceUid) {
    return await db.getVideosBySource(platform || 'bili', sourceUid)
  }
  return await db.getSourceList(platform || null)
})
```

### 改动文件

`electron/preload.ts`

新增：

```typescript
submitAgentForm: (data: Record<string, string>) => ipcRenderer.invoke('agent-submit-form', data),
queryData: (platform?: string, sourceUid?: string) => ipcRenderer.invoke('query-data', platform, sourceUid),
```

### 改动文件

`src/types/electron.d.ts`

新增：

```typescript
submitAgentForm: (data: Record<string, string>) => Promise<boolean>
queryData: (platform?: string, sourceUid?: string) => Promise<any>
```

---

## 六、前端表单处理

### 改动文件

`src/components/ChatView.tsx`

**a) 新增 Agent 表单状态**：

```tsx
const [agentFormRequest, setAgentFormRequest] = useState<{
  message: string
  fields: { name: string; label: string; type: string; options?: string[]; placeholder?: string }[]
} | null>(null)
```

**b) 在 onAgentEvent 中处理 form_request**：

```typescript
if (event.type === 'form_request') {
  setAgentFormRequest({
    message: event.message,
    fields: event.fields,
  })
  setStatus('请在弹出的表单中填写信息...')
}
```

**c) 表单提交处理**：

```tsx
const handleAgentFormSubmit = async (data: Record<string, string>) => {
  // 提交给 Agent
  await window.electronAPI?.submitAgentForm(data)

  // 在对话中显示用户填写的内容
  const summary = Object.entries(data).map(([k, v]) => `${v}`).join('、')
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
```

**d) 渲染表单弹窗**（复用之前设计的 IntentFormModal）：

```tsx
{agentFormRequest && (
  <IntentFormModal
    pattern={{
      id: 'agent_request',
      name: '需要补充信息',
      icon: 'info',
      fields: agentFormRequest.fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type as 'text' | 'select',
        options: f.options,
        placeholder: f.placeholder,
        required: true,
      })),
    }}
    onSubmit={handleAgentFormSubmit}
    onClose={() => setAgentFormRequest(null)}
  />
)}
```

---

## 七、意图预检测（第一层，可选）

在 `ChatView.tsx` 的 `handleSend` 中，发送前先检测意图。如果匹配到需要表单的意图，先弹表单再发送。

详见 `docs/cc_agent_smart.md` 中的第一层方案，代码可直接复用。

---

## 验收标准

### Agent 能力

- [ ] 发送"帮我分析B站UP主 440609243"→ Agent 调用 crawl_data 爬取数据 → 基于数据给出分析报告
- [ ] 发送"分析B站UP主"（不给 UID）→ Agent 调用 request_user_input 弹表单 → 用户填写 UID → Agent 继续处理
- [ ] 发送"帮我生成物料" + 脚本内容 → Agent 直接生成各平台物料并调用 save_result
- [ ] 发送"帮我生成物料"（不给脚本）→ Agent 弹表单请求脚本内容
- [ ] 发送"生成字幕" + 口播稿 → Agent 直接输出 SRT 格式字幕
- [ ] 发送"优化标题" + 标题 → Agent 生成四平台标题选项
- [ ] 发送"创作灵感" + 方向 → Agent 给出选题建议
- [ ] 发送"看看我的数据" → Agent 调用 query_data 查询并展示
- [ ] 发送"你好" → Agent 正常闲聊，不走脚本流程
- [ ] Agent 的分析报告引用真实数据数字，不编造

### 工具调用

- [ ] crawl_data 能成功触发 MediaCrawler 爬取数据
- [ ] query_data 能查询已有数据
- [ ] save_result 正常工作（已有）
- [ ] request_user_input 能弹出表单并接收用户输入

### 表单交互

- [ ] Agent 工具触发的表单能正常弹出
- [ ] 表单填写后 Agent 能继续处理
- [ ] 表单内容在对话中以用户消息形式显示

---

## 执行顺序

1. 重写系统提示词（core.js）— 最重要，立竿见影
2. 新建 crawl_data + query_data + request_user_input 工具
3. 注册工具（index.js）
4. Agent 工具执行改造（core.js stream 方法）
5. IPC 层改造（main.ts + preload.ts + electron.d.ts）
6. 前端表单处理（ChatView.tsx）
7. 意图预检测（ChatView.tsx，可选）

---

*知更 Knower · Agent 全面智能化改造提示词*
