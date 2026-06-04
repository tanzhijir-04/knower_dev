# 知更 Knower · 灵感库功能 PRD

**版本** v1.0
**日期** 2026-06-01
**状态** 待开发
**关联模块** 灵感库（TopicsView）、创作台（ChatView）、数据概览（DataView）

---

## 一、功能概述

灵感库是知更的核心差异化模块，目标是**让 AI 基于创作者的真实数据，持续提供个性化的选题建议**。与通用 AI 工具的"帮你想想选题"不同，知更的选题建议建立在两个数据飞轮上：

1. **内部数据**：用户自己账号的历史表现数据（来自数据概览模块的爬取结果）
2. **外部数据**：平台实时趋势数据（来自 MediaCrawler 爬取的热榜/热门内容）

两个数据源形成闭环：内部数据让 AI 知道"什么在你的账号上有效"，外部数据让 AI 知道"平台上什么在爆"。随着数据积累，建议质量持续提升。

---

## 二、当前状态

### 已完成

| 组件 | 状态 | 说明 |
|------|------|------|
| TopicsView 页面 | ✅ 基础框架 | 平台切换、AI 生成按钮、收藏切换 |
| TopicCard 组件 | ✅ 已完成 | 选题卡片展示（标题、来源标签、预估表现） |
| TopicDetail 组件 | ✅ 已完成 | 选题详情面板（推荐理由、标签、操作按钮） |
| TrendPanel 组件 | ✅ 已完成 | 侧边栏趋势列表（近 7 天热门内容） |
| suggest_topics 工具 | ✅ 已完成 | Agent 工具，调用 LLM 生成选题 |
| DB 表 saved_topics | ✅ 已完成 | 收藏选题持久化 |
| DB 函数 getRecentTrends | ✅ 已完成 | 查询近期趋势数据 |
| DB 函数 getTopContent | ✅ 已完成 | 查询高互动内容 |
| IPC handlers | ✅ 已完成 | topics-suggest/topics-trends/topics-save/topics-saved/topic-to-chat |

### 待开发（本 PRD 范围）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 多维选题模式 | P0 | 支持多种选题策略（趋势追热、差异化切入、竞品对标、系列化） |
| 竞品追踪 | P0 | 追踪同赛道创作者的选题动态 |
| 选题评分系统 | P1 | AI 对每个选题给出多维度评分（热度匹配度、竞争度、可执行性） |
| 选题工作流 | P1 | 从选题 → 确认 → 生成大纲 → 进入创作台的完整链路 |
| 选题历史与反馈 | P2 | 记录用户采纳/忽略的选题，训练个性化模型 |
| 定时选题推送 | P2 | 后台定期生成新选题，通知用户 |

---

## 三、功能详细设计

### 3.1 选题生成模式

当前 suggest_topics 工具只有一个简单的 prompt，生成 5 个选题。需要扩展为多种策略：

#### 模式一：趋势追热（Trend-Following）

**触发词**：「最近有什么热点」「帮我追个热点」「现在什么火」

**逻辑**：
1. 从 crawl_content 表拉取最近 7 天各平台热榜数据
2. 过滤掉与用户历史内容方向无关的热点
3. 结合用户账号定位，将热点转化为可执行的选题
4. 标注时效性（"24h 内热度高"、"预计持续 3-5 天"）

**输出格式扩展**：
`json
{
  "title": "选题标题",
  "reason": "推荐理由",
  "source": "当前趋势",
  "estimatedPerformance": "高",
  "tags": ["标签1", "标签2"],
  "urgency": "24h",
  "trendScore": 85,
  "competitionLevel": "中",
  "matchScore": 72,
  "actionPlan": "建议今天拍摄，明天发布"
}
`

#### 模式二：差异化切入（Differentiated Angle）

**触发词**：「有没有不一样的角度」「别人做烂了，有没有新意」「帮我找个冷门方向」

**逻辑**：
1. 分析用户历史高互动内容的共性（选题方向、标题模式、内容结构）
2. 从爬取数据中找到**低竞争、高潜力**的细分领域
3. 结合平台算法偏好，推荐"蓝海"选题
4. 标注竞争度（"同赛道视频 < 50 条"、"搜索量上升中"）

#### 模式三：竞品对标（Competitor Analysis）

**触发词**：「看看我的竞品在做什么」「分析一下 XX UP 主」「有什么值得借鉴的」

**逻辑**：
1. 从 crawl_content 和 crawl_creators 表获取竞品数据
2. 分析竞品近期高互动视频的共性
3. 找到竞品覆盖但用户未覆盖的选题方向
4. 标注竞品数据来源（"B站某 UP 主同类视频平均播放 10 万"）

**需要新增 DB 查询**：
`sql
-- 查询竞品近期内容（排除用户自己的内容）
SELECT cc.title, cc.play_count, cc.like_count, cc.category, cc.author_name
FROM crawl_content cc
WHERE cc.platform = ?
  AND cc.author_id != ?
  AND cc.created_at > datetime('now', '-7 days')
ORDER BY cc.play_count DESC
LIMIT 30
`

#### 模式四：系列化（Series Planning）

**触发词**：「帮我规划一个系列」「做个连载计划」「这几期怎么做」

**逻辑**：
1. 分析用户历史高互动内容，找到可系列化的主题
2. 规划 5-10 期的系列内容，每期有明确的子主题
3. 标注系列内部逻辑（"第 1 期基础 → 第 2 期进阶 → 第 3 期实战"）
4. 预估系列整体表现（"参考同类系列平均播放"）

---

### 3.2 选题评分系统

每个选题需要给出多维度评分，帮助用户快速判断优先级：

#### 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 热度匹配度 | 30% | 选题与当前平台热点的匹配程度 |
| 竞争度 | 25% | 同类内容的数量和质量（越低越好） |
| 可执行性 | 20% | 基于用户资源（设备、团队规模）的制作难度 |
| 账号契合度 | 15% | 与用户历史高互动内容的相似度 |
| 时效性 | 10% | 热点的生命周期（长期/短期/已过期） |

#### 评分展示

在 TopicCard 上增加评分指示器：

`
┌─────────────────────────────────┐
│  标题：AI 帮我剪了 100 条视频     │
│  理由：近期 AI 工具热度持续上升    │
│                                 │
│  热度 ████████░░ 85              │
│  竞争 ██████░░░░ 60              │
│  执行 █████████░ 90              │
│  契合 ███████░░░ 70              │
│  时效 █████████░ 90              │
│                                 │
│  综合评分：78/100                 │
│  [发到创作台] [收藏]              │
└─────────────────────────────────┘
`

#### 评分计算

在 suggest_topics 工具中，让 LLM 返回评分数据：

`javascript
// 在 suggest_topics.js 的 prompt 中增加
const response = await client.chat({
  system: 你是一位视频选题策划专家。根据数据为创作者生成个性化选题建议。

评分规则：
- 热度匹配度：基于趋势数据中相关内容的播放量
- 竞争度：基于同类视频数量（越少越好）
- 可执行性：基于用户历史内容的制作复杂度
- 账号契合度：与用户高互动内容的相似度
- 时效性：热点生命周期判断

只返回 JSON 数组，不要有任何其他文字。,
  messages: [{
    role: 'user',
    content: 请为一位视频创作者生成  个选题建议。

## 创作者历史高互动内容


## 当前平台趋势


## 创作者已知偏好


## 要求
每个选题包含：
- title: 选题标题（有吸引力，15字以内）
- reason: 推荐理由（基于数据依据，30字以内）
- source: 灵感来源（"历史高互动"/"当前趋势"/"结合两者"）
- estimatedPerformance: 预估表现（"高"/"中"/"参考同类"）
- tags: 建议标签（3-5个）
- scores: { heat: 0-100, competition: 0-100, feasibility: 0-100, fit: 0-100, urgency: 0-100 }
- urgency: 时效性（"24h"/"3天"/"长期"）
- competitionLevel: 竞争度（"低"/"中"/"高"）
- actionPlan: 行动建议（一句话）

返回 JSON 数组，不要有其他文字。,
  }],
  maxTokens: 2048,
})
`

---

### 3.3 竞品追踪

#### 功能设计

在 TrendPanel 侧边栏增加"竞品追踪"区域：

`
┌─────────────────────┐
│  平台趋势           │
│  近 7 天热门内容     │
├─────────────────────┤
│  1. 标题...         │
│  2. 标题...         │
│  ...                │
├─────────────────────┤
│  竞品追踪           │
│  已追踪 3 个创作者   │
├─────────────────────┤
│  🟢 UP主A           │
│     新视频: 标题...  │
│     播放: 5.2万     │
│  🟢 UP主B           │
│     新视频: 标题...  │
│     播放: 3.8万     │
│  + 添加竞品         │
└─────────────────────┘
`

#### 数据模型

在 crawl_content 表中，通过 source_uid 区分竞品内容。需要新增一个 competitors 表：

`sql
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  added_at DATETIME DEFAULT (datetime('now','localtime')),
  last_checked_at DATETIME
);
`

#### 竞品管理

1. **添加竞品**：从 DataView 的创作者列表中"标记为竞品"，或手动输入 UID
2. **自动更新**：每次打开灵感库，自动检查竞品最近 7 天的新内容
3. **竞品分析**：AI 对比用户与竞品的内容差异，给出差异化建议

#### DB 函数新增

`javascript
// db/index.js
async function getCompetitors(accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    'SELECT * FROM competitors WHERE account_id = ? ORDER BY added_at DESC',
    [accountId]
  )
  // ... 解析返回
}

async function addCompetitor(accountId, platform, userId, nickname, avatarUrl = '') {
  const db = await getDb()
  db.run(
    'INSERT INTO competitors (account_id, platform, user_id, nickname, avatar_url) VALUES (?, ?, ?, ?, ?)',
    [accountId, platform, userId, nickname, avatarUrl]
  )
  saveDb()
}

async function getCompetitorRecentContent(platform, competitorUids, days = 7, accountId = 'default') {
  const db = await getDb()
  const placeholders = competitorUids.map(() => '?').join(',')
  const dateThreshold = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const res = db.exec(
    SELECT cc.title, cc."desc", cc.play_count, cc.like_count, cc.author_name, cc.author_id, cc.created_at, cc.category
     FROM crawl_content cc
     WHERE cc.platform = ?
       AND cc.author_id IN ()
       AND cc.created_at > ?
       AND cc.account_id = ?
     ORDER BY cc.play_count DESC
     LIMIT 30,
    [platform, ...competitorUids, dateThreshold, accountId]
  )
  // ... 解析返回
}
`

---

### 3.4 选题工作流

从选题到创作的完整链路：

`
选题生成 → 评分排序 → 用户选择 → 确认方向 → AI 生成大纲 → 进入创作台
   ↓           ↓           ↓           ↓           ↓           ↓
 趋势+数据    多维评分    点击卡片    补充细节    结构化输出   自动填充输入框
`

#### 步骤详解

**Step 1: 选题生成**
- 用户点击"AI 生成选题"
- 选择生成模式（趋势追热/差异化/竞品对标/系列化）
- Agent 调用 suggest_topics 工具，传入 mode 参数
- 返回带评分的选题列表

**Step 2: 评分排序**
- 前端按综合评分降序排列
- 用户可按维度筛选（"只要热度高的"、"只要竞争低的"）
- 高亮显示综合评分 > 80 的选题

**Step 3: 用户选择**
- 点击选题卡片，展开详情面板
- 详情面板显示：推荐理由、各维度评分、竞品数据、行动建议
- 底部两个按钮："发到创作台" / "收藏"

**Step 4: 确认方向**
- 点击"发到创作台"后，弹出确认对话框
- 用户可补充：目标时长、特殊要求、参考视频
- 确认后跳转到创作台，自动填充 prompt

**Step 5: AI 生成大纲**
- 在创作台中，Agent 自动调用 xpand_script 工具
- 生成结构化大纲（分镜、景别、道具、场地）
- 用户可修改大纲后再生成物料

---

### 3.5 选题历史与反馈（P2）

#### 目标

记录用户的选题采纳行为，形成个性化反馈闭环：

- 用户"发到创作台"的选题 → 记录为"采纳"
- 用户"收藏"但未使用的选题 → 记录为"感兴趣"
- 用户忽略的选题 → 记录为"未采纳"

#### 数据模型

`sql
CREATE TABLE IF NOT EXISTS topic_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  topic_title TEXT NOT NULL,
  topic_data TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'adopted' / 'interested' / 'ignored'
  created_at DATETIME DEFAULT (datetime('now','localtime'))
);
`

#### 反馈闭环

1. **用户行为采集**：每次"发到创作台"或"收藏"时，写入 	opic_feedback
2. **偏好分析**：定期分析用户采纳的选题共性（标题风格、话题领域、来源类型）
3. **记忆更新**：将分析结果写入 memories 表，提升后续选题的个性化程度
4. **效果追踪**：如果用户最终发布了视频，对比选题预估表现与实际表现

---

## 四、UI 设计规范

### 4.1 页面布局

灵感库采用三栏布局：

`
┌──────────────────────────────────────────────────────────────┐
│  [标题栏] 灵感库          [平台切换] [收藏] [AI 生成选题]      │
├────────────┬───────────────────────────┬─────────────────────┤
│            │                           │                     │
│  趋势面板  │      选题列表区域          │    选题详情面板      │
│  (240px)   │      (flex-1)             │    (320px)          │
│            │                           │                     │
│  近7天热门  │  ┌─────────┐ ┌─────────┐ │  标题               │
│  1. xxx    │  │ 选题卡片 │ │ 选题卡片 │ │  推荐理由           │
│  2. xxx    │  └─────────┘ └─────────┘ │  评分雷达图         │
│  ...       │  ┌─────────┐ ┌─────────┐ │  竞品数据           │
│            │  │ 选题卡片 │ │ 选题卡片 │ │  行动建议           │
│  竞品追踪  │  └─────────┘ └─────────┘ │                     │
│  UP主A     │                           │  [发到创作台]       │
│  UP主B     │                           │  [收藏]             │
│  + 添加    │                           │                     │
├────────────┴───────────────────────────┴─────────────────────┤
│  状态栏：AI 正在分析趋势... / 已生成 5 个选题 / 已收藏         │
└──────────────────────────────────────────────────────────────┘
`

### 4.2 选题卡片设计

`	sx
// TopicCard.tsx 扩展
interface TopicCardProps {
  topic: TopicSuggestion & {
    scores?: {
      heat: number
      competition: number
      feasibility: number
      fit: number
      urgency: number
    }
    urgency?: string
    competitionLevel?: string
    actionPlan?: string
  }
  onClick: () => void
  isActive: boolean
}
`

卡片布局：

`
┌─────────────────────────────────┐
│  标题：AI 帮我剪了 100 条视频     │
│  理由：近期 AI 工具热度持续上升    │
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 当前趋势 │ │ 24h │ │ 竞争中 │   │
│  └──────┘ └──────┘ └──────┘   │
│                                 │
│  热度 ████████░░ 85              │
│  综合 ███████░░░ 78              │
│                                 │
│  #AI工具 #视频剪辑 #效率提升      │
└─────────────────────────────────┘
`

### 4.3 评分雷达图

在详情面板中使用雷达图展示多维评分：

`	sx
// 新增组件 TopicRadar.tsx
// 使用 SVG 绘制五维雷达图
const dimensions = [
  { key: 'heat', label: '热度', value: 85 },
  { key: 'competition', label: '竞争', value: 60 },  // 注意：竞争度越低越好
  { key: 'feasibility', label: '执行', value: 90 },
  { key: 'fit', label: '契合', value: 70 },
  { key: 'urgency', label: '时效', value: 90 },
]
`

### 4.4 生成模式选择器

点击"AI 生成选题"按钮后，弹出模式选择菜单：

`
┌─────────────────────────────────┐
│  选择选题策略                     │
├─────────────────────────────────┤
│  🔥 趋势追热                     │
│     追踪平台热点，快速切入         │
├─────────────────────────────────┤
│  💡 差异化切入                    │
│     找蓝海方向，避开红海竞争       │
├─────────────────────────────────┤
│  🎯 竞品对标                     │
│     分析竞品选题，找到差异化机会    │
├─────────────────────────────────┤
│  📚 系列化规划                   │
│     规划连载内容，提升用户粘性      │
└─────────────────────────────────┘
`

### 4.5 空状态设计

`
┌─────────────────────────────────┐
│                                 │
│         💡                      │
│                                 │
│   暂无选题建议                   │
│                                 │
│   点击上方 "AI 生成选题" 开始     │
│   或先在数据概览中爬取平台数据    │
│                                 │
│   [去数据概览爬取数据]            │
│                                 │
└─────────────────────────────────┘
`

---

## 五、Agent 工具扩展

### 5.1 suggest_topics 工具改造

#### 新增参数

`javascript
// suggest_topics.js
input_schema: {
  type: 'object',
  properties: {
    platform: { type: 'string', description: '目标平台（bili/dy/xhs/wb）' },
    count: { type: 'number', description: '生成选题数量，默认 5' },
    mode: {
      type: 'string',
      description: '选题策略（trend/differentiated/competitor/series），默认 trend',
      enum: ['trend', 'differentiated', 'competitor', 'series'],
    },
    competitorUids: {
      type: 'array',
      items: { type: 'string' },
      description: '竞品用户 ID 列表（仅 competitor 模式使用）',
    },
    seriesTopic: {
      type: 'string',
      description: '系列主题（仅 series 模式使用）',
    },
  },
  required: ['platform'],
}
`

#### 模式差异化 Prompt

`javascript
const MODE_PROMPTS = {
  trend: 
基于平台趋势数据，生成追热型选题。
重点：时效性、热点匹配度、快速执行。
每个选题必须关联至少一个具体热点事件。
,

  differentiated: 
分析用户历史数据和平台内容分布，找到差异化方向。
重点：低竞争、高潜力、与用户风格契合。
避免推荐已经泛滥的选题方向。
,

  competitor: 
基于竞品近期内容，找到差异化切入点。
重点：竞品覆盖但用户未覆盖的方向、竞品的薄弱环节。
给出具体的差异化角度。
,

  series: 
基于用户历史高互动内容，规划系列化内容。
重点：系列内部逻辑、每期独立价值、用户留存。
给出 5-10 期的系列规划。
,
}
`

### 5.2 新增工具：analyze_topic

当用户选择一个选题后，可以深度分析：

`javascript
// agent/tools/analyze_topic.js
module.exports = {
  name: 'analyze_topic',
  description: 深度分析一个选题的可行性，包括竞品数据、用户画像、内容策略建议。

**什么时候调用：**
- 用户说"分析这个选题"、"这个选题怎么样"
- 用户点击选题详情面板的"深度分析"按钮

**什么时候不要调用：**
- 用户只是浏览选题列表
- 用户已经决定要做这个选题,
  input_schema: {
    type: 'object',
    properties: {
      topicTitle: { type: 'string', description: '选题标题' },
      topicReason: { type: 'string', description: '选题理由' },
      platform: { type: 'string', description: '目标平台' },
    },
    required: ['topicTitle', 'platform'],
  },
  async execute({ topicTitle, topicReason, platform, accountId }) {
    // 1. 查询同主题的竞品内容
    // 2. 分析用户历史相关内容
    // 3. 评估可行性
    // 4. 生成详细建议
    return {
      topic: topicTitle,
      feasibility: { score: 85, factors: [...] },
      competitorAnalysis: [...],
      contentStrategy: '...',
      executionPlan: [...],
    }
  },
}
`

### 5.3 工具注册

在 gent/tools/index.js 中注册新工具：

`javascript
const analyzeTopic = require('./analyze_topic')
const tools = [crawlData, crawlDataBatch, queryData, requestUserInput,
               saveResult, analyzeScript, expandScript, suggestTopics, analyzeTopic]
`

---

## 六、IPC 接口扩展

### 6.1 现有接口增强

`	ypescript
// electron.d.ts
export interface TopicSuggestion {
  title: string
  reason: string
  source: string
  estimatedPerformance: string
  tags: string[]
  platforms?: string[]
  // 新增字段
  scores?: {
    heat: number
    competition: number
    feasibility: number
    fit: number
    urgency: number
  }
  urgency?: string
  competitionLevel?: string
  actionPlan?: string
  overallScore?: number
}
`

### 6.2 新增接口

`	ypescript
// preload.ts
export interface ElectronAPI {
  // ... 现有接口

  // 灵感库（扩展）
  suggestTopics: (platform: string, mode?: string, options?: Record<string, unknown>) =>
    Promise<{ topics: TopicSuggestion[]; error?: string }>
  analyzeTopic: (topicTitle: string, topicReason: string, platform: string) =>
    Promise<{ analysis: TopicAnalysis | null; error?: string }>

  // 竞品管理
  getCompetitors: (platform: string) => Promise<Competitor[]>
  addCompetitor: (platform: string, userId: string, nickname: string) => Promise<boolean>
  removeCompetitor: (id: number) => Promise<boolean>
  getCompetitorContent: (platform: string, days?: number) => Promise<CompetitorContent[]>

  // 选题反馈
  recordTopicFeedback: (topicTitle: string, topicData: Record<string, unknown>, action: string) => Promise<boolean>
  getTopicStats: () => Promise<TopicStats>
}

export interface Competitor {
  id: number
  platform: string
  userId: string
  nickname: string
  avatarUrl: string
  addedAt: string
  lastCheckedAt: string | null
}

export interface CompetitorContent {
  title: string
  desc: string
  playCount: number
  likeCount: number
  authorName: string
  createdAt: string
  category: string
}

export interface TopicAnalysis {
  topic: string
  feasibility: { score: number; factors: string[] }
  competitorAnalysis: { title: string; playCount: number; engagementRate: number }[]
  contentStrategy: string
  executionPlan: string[]
}

export interface TopicStats {
  totalGenerated: number
  totalAdopted: number
  totalIgnored: number
  adoptionRate: number
  topCategories: { category: string; count: number }[]
}
`

### 6.3 main.ts 新增 Handlers

`	ypescript
// electron/main.ts

// 竞品管理
ipcMain.handle('competitors-list', async (_event, platform: string) => {
  const active = await db.getActiveAccount()
  return await db.getCompetitors(platform, active?.id || 'default')
})

ipcMain.handle('competitors-add', async (_event, platform: string, userId: string, nickname: string) => {
  const active = await db.getActiveAccount()
  await db.addCompetitor(active?.id || 'default', platform, userId, nickname)
  return true
})

ipcMain.handle('competitors-remove', async (_event, id: number) => {
  await db.removeCompetitor(id)
  return true
})

ipcMain.handle('competitors-content', async (_event, platform: string, days: number = 7) => {
  const active = await db.getActiveAccount()
  const competitors = await db.getCompetitors(platform, active?.id || 'default')
  const uids = competitors.map(c => c.userId)
  if (uids.length === 0) return []
  return await db.getCompetitorRecentContent(platform, uids, days, active?.id || 'default')
})

// 选题深度分析
ipcMain.handle('topic-analyze', async (_event, topicTitle: string, topicReason: string, platform: string) => {
  const analyzeTool = require('../knower-agent/agent/tools/analyze_topic')
  const active = await db.getActiveAccount()
  return await analyzeTool.execute({
    topicTitle,
    topicReason,
    platform,
    accountId: active?.id || 'default',
  })
})

// 选题反馈
ipcMain.handle('topic-feedback', async (_event, topicTitle: string, topicData: Record<string, unknown>, action: string) => {
  const active = await db.getActiveAccount()
  await db.recordTopicFeedback(active?.id || 'default', topicTitle, topicData, action)
  return true
})

ipcMain.handle('topic-stats', async () => {
  const active = await db.getActiveAccount()
  return await db.getTopicStats(active?.id || 'default')
})
`

---

## 七、数据库变更

### 7.1 新增表

`sql
-- 竞品追踪
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  added_at DATETIME DEFAULT (datetime('now','localtime')),
  last_checked_at DATETIME
);

-- 选题反馈
CREATE TABLE IF NOT EXISTS topic_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  topic_title TEXT NOT NULL,
  topic_data TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'adopted' / 'interested' / 'ignored'
  created_at DATETIME DEFAULT (datetime('now','localtime'))
);
`

### 7.2 新增函数

`javascript
// db/index.js

// 竞品管理
async function getCompetitors(platform, accountId = 'default') { ... }
async function addCompetitor(accountId, platform, userId, nickname, avatarUrl = '') { ... }
async function removeCompetitor(id) { ... }
async function getCompetitorRecentContent(platform, competitorUids, days = 7, accountId = 'default') { ... }

// 选题反馈
async function recordTopicFeedback(accountId, topicTitle, topicData, action) { ... }
async function getTopicStats(accountId = 'default') { ... }
`

---

## 八、前端组件改造

### 8.1 TopicsView.tsx 改造

`	sx
// 新增状态
const [generateMode, setGenerateMode] = useState<string>('trend')
const [showModeSelector, setShowModeSelector] = useState(false)
const [competitors, setCompetitors] = useState<Competitor[]>([])
const [showCompetitorPanel, setShowCompetitorPanel] = useState(false)
const [topicStats, setTopicStats] = useState<TopicStats | null>(null)

// 生成选题时传入模式
const handleGenerate = async (mode: string = 'trend') => {
  const result = await api.suggestTopics(platform, mode)
  // ...
}

// 排序逻辑
const sortedTopics = [...displayTopics].sort((a, b) => {
  return (b.overallScore || 0) - (a.overallScore || 0)
})
`

### 8.2 TopicCard.tsx 改造

`	sx
// 增加评分展示
<div className="mt-2">
  <div className="flex items-center gap-2 text-[10px] text-muted">
    <span>热度</span>
    <div className="flex-1 h-1 bg-hairline rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full"
        style={{ width: ${topic.scores?.heat || 0}% }}
      />
    </div>
    <span>{topic.scores?.heat || '-'}</span>
  </div>
  {/* 其他维度类似 */}
</div>

// 增加综合评分徽章
{topic.overallScore && (
  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium
    bg-primary/15 text-primary">
    {topic.overallScore}
  </div>
)}
`

### 8.3 TrendPanel.tsx 改造

`	sx
// 增加竞品追踪区域
<div className="border-t border-hairline/30">
  <div className="px-4 py-3">
    <h3 className="text-sm font-medium text-ink">竞品追踪</h3>
    <p className="text-[11px] text-muted mt-0.5">已追踪 {competitors.length} 个创作者</p>
  </div>
  <div className="divide-y divide-hairline/20">
    {competitors.map(comp => (
      <div key={comp.id} className="px-3 py-2.5 hover:bg-canvas-soft transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] text-primary">{comp.nickname[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink truncate">{comp.nickname}</p>
            <p className="text-[10px] text-muted">
              {comp.lastCheckedAt ? '已更新' : '待更新'}
            </p>
          </div>
        </div>
      </div>
    ))}
    <button
      onClick={() => setShowAddCompetitor(true)}
      className="w-full px-3 py-2 text-xs text-primary hover:bg-canvas-soft transition-colors"
    >
      + 添加竞品
    </button>
  </div>
</div>
`

### 8.4 TopicDetail.tsx 改造

`	sx
// 增加评分雷达图
import TopicRadar from './TopicRadar'

// 在详情面板中
<div className="bg-surface-low rounded-xl p-5 border border-hairline/20">
  <h3 className="text-base font-medium text-ink mb-3">{topic.title}</h3>

  {/* 雷达图 */}
  {topic.scores && (
    <div className="mb-4">
      <TopicRadar scores={topic.scores} />
    </div>
  )}

  {/* 推荐理由 */}
  <div className="mb-4">
    <span className="text-xs text-muted block mb-1">推荐理由</span>
    <p className="text-sm text-ink">{topic.reason}</p>
  </div>

  {/* 行动建议 */}
  {topic.actionPlan && (
    <div className="mb-4 p-3 bg-primary/5 rounded-lg">
      <span className="text-xs text-primary block mb-1">行动建议</span>
      <p className="text-sm text-ink">{topic.actionPlan}</p>
    </div>
  )}

  {/* 竞争度和时效性 */}
  <div className="grid grid-cols-2 gap-3 mb-4">
    <div>
      <span className="text-xs text-muted block mb-1">竞争度</span>
      <span className={	ext-sm }>{topic.competitionLevel || '-'}</span>
    </div>
    <div>
      <span className="text-xs text-muted block mb-1">时效性</span>
      <span className="text-sm text-ink">{topic.urgency || '-'}</span>
    </div>
  </div>

  {/* 操作按钮 */}
  <div className="flex gap-2 pt-2">
    <button
      onClick={onSendToChat}
      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2
        bg-primary/15 text-primary text-sm rounded-lg hover:bg-primary/25 transition-colors"
    >
      <ChatCircle className="w-4 h-4" weight="fill" />
      发到创作台
    </button>
    <button
      onClick={onSave}
      className="flex items-center justify-center gap-1.5 px-3 py-2
        bg-canvas-soft text-body text-sm rounded-lg hover:bg-hairline transition-colors"
    >
      <BookmarkSimple className="w-4 h-4" weight="fill" />
      收藏
    </button>
  </div>
</div>
`

---

## 九、实现计划

### 阶段一：核心评分系统（3天）

| 任务 | 文件 | 预估 |
|------|------|------|
| 扩展 suggest_topics 工具 | knower-agent/agent/tools/suggest_topics.js | 4h |
| 增加 TopicSuggestion 类型 | src/types/electron.d.ts | 1h |
| TopicCard 增加评分展示 | src/components/topics/TopicCard.tsx | 3h |
| TopicDetail 增加评分雷达图 | src/components/topics/TopicDetail.tsx + TopicRadar.tsx | 4h |
| TopicsView 排序逻辑 | src/components/TopicsView.tsx | 2h |
| 测试评分系统 | 手动测试 | 2h |

### 阶段二：选题模式（2天）

| 任务 | 文件 | 预估 |
|------|------|------|
| 模式选择器 UI | src/components/topics/ModeSelector.tsx | 3h |
| 四种模式的 Prompt | knower-agent/agent/tools/suggest_topics.js | 4h |
| IPC 接口扩展 | lectron/main.ts + lectron/preload.ts | 2h |
| 集成测试 | 手动测试 | 2h |

### 阶段三：竞品追踪（2天）

| 任务 | 文件 | 预估 |
|------|------|------|
| competitors 表和函数 | knower-agent/db/index.js | 3h |
| 竞品管理 UI | src/components/topics/CompetitorPanel.tsx | 4h |
| TrendPanel 集成竞品区域 | src/components/topics/TrendPanel.tsx | 2h |
| 测试竞品功能 | 手动测试 | 2h |

### 阶段四：选题工作流（2天）

| 任务 | 文件 | 预估 |
|------|------|------|
| analyze_topic 工具 | knower-agent/agent/tools/analyze_topic.js | 4h |
| 选题到创作台的链路 | src/components/TopicsView.tsx + ChatView.tsx | 3h |
| 确认对话框 | src/components/topics/TopicConfirmDialog.tsx | 2h |
| 集成测试 | 手动测试 | 2h |

### 阶段五：反馈闭环（P2，后续）

| 任务 | 文件 | 预估 |
|------|------|------|
| topic_feedback 表和函数 | knower-agent/db/index.js | 2h |
| 反馈采集逻辑 | src/components/TopicsView.tsx | 2h |
| 偏好分析 | knower-agent/agent/tools/suggest_topics.js | 3h |
| 统计面板 | src/components/topics/TopicStats.tsx | 3h |

---

## 十、成功指标

### 核心指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 选题采纳率 | > 30% | 用户"发到创作台"的选题占生成总数的比例 |
| 选题生成成功率 | > 95% | 成功返回选题列表的比例 |
| 平均评分准确度 | > 70% | 预估表现与实际表现的一致性（需追踪） |
| 用户留存 | > 60% | 使用灵感库后继续使用的比例 |

### 体验指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 生成延迟 | < 8s | 从点击到返回选题的时间 |
| 评分可读性 | 用户可理解 | 评分维度和分数对用户有意义 |
| 操作流畅度 | < 3 步 | 从选题到进入创作台的操作步骤 |
| 空状态引导 | 100% | 无数据时给出明确的行动指引 |

---

## 十一、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 生成不稳定 | 评分数据可能缺失或异常 | 前端做容错处理，缺失时显示"-" |
| 竞品数据不足 | 差异化建议质量差 | 提示用户先爬取竞品数据 |
| 趋势数据过时 | 推荐已过期的热点 | 设置 24h 过期机制，标注时效性 |
| 用户不理解评分 | 评分形同虚设 | 增加评分说明 tooltip，可折叠评分区域 |

---

*知更 Knower · 灵感库功能 PRD v1.0*
