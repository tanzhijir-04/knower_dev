# 给 CC 的提示词：数据分析页全面改版

## 背景

当前数据分析页功能太基础：只有概览卡片 + 互动率排行表格 + AI 分析文字。缺少专业图表、数据维度选择、粉丝数、下钻查看、数据导出。需要全面改版为一个专业的数据分析面板。

---

## 一、图表系统

### 技术选型：ECharts

安装：

```bash
npm install echarts echarts-for-react
```

选择 ECharts 的原因：
- 功能最全（折线/柱状/饼图/雷达/漏斗/热力图全支持）
- 中文生态好，文档齐全
- 暗色主题内置支持
- 体积可按需引入（tree-shaking）

### 图表清单

| 图表 | 类型 | 数据来源 | 用途 |
|---|---|---|---|
| 播放量趋势 | 折线图 | `crawl_content.play_count` + `created_at` | 按时间维度看播放量变化 |
| 互动率分布 | 饼图 | 本地计算 like/play/comment 比例 | 看各互动类型占比 |
| 内容分类占比 | 环形图 | `crawl_content.category` | 各分类视频数量占比 |
| 平台对比（多平台时） | 柱状图 | 各平台 play/like/comment 汇总 | 跨平台数据对比 |
| 发布时间分布 | 柱状图 | `crawl_content.created_at` 按小时分组 | 最佳发布时间 |
| 标题长度 vs 播放量 | 散点图 | 标题字数 + play_count | 标题长度对播放的影响 |
| 综合评分雷达图 | 雷达图 | 播放/点赞/评论/分享/投币/收藏 六维 | 创作者能力画像 |

### 图表暗色主题配置

```javascript
// src/lib/chartTheme.ts
export const darkTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#bccabb' },
  title: { textStyle: { color: '#dde5da' } },
  legend: { textStyle: { color: '#bccabb' } },
  xAxis: {
    axisLine: { lineStyle: { color: '#3d4a3e' } },
    axisLabel: { color: '#869486' },
    splitLine: { lineStyle: { color: '#1a211b' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#3d4a3e' } },
    axisLabel: { color: '#869486' },
    splitLine: { lineStyle: { color: '#1a211b' } },
  },
  tooltip: {
    backgroundColor: '#1a211b',
    borderColor: '#3d4a3e',
    textStyle: { color: '#dde5da' },
  },
  color: ['#6bfb9a', '#4ade80', '#22c55e', '#16a34a', '#86efac', '#bbf7d0'],
}
```

---

## 二、数据维度选择器

### 目标

用户可以自由选择要看哪些数据维度，页面根据选择动态展示。

### 维度定义

| 维度 | 数据字段 | 图表类型 | 默认开启 |
|---|---|---|---|
| 播放量 | `play_count` | 折线图 + 概览卡片 | ✅ |
| 点赞数 | `like_count` | 概览卡片 | ✅ |
| 评论数 | `comment_count` | 概览卡片 | ✅ |
| 分享数 | `share_count` | 概览卡片 | - |
| 粉丝数 | `total_fans`（来自 creators 表） | 概览卡片 + 趋势 | ✅ |
| 收藏数 | `raw_json.video_favorite_count` | 概览卡片 | - |
| 投币数 | `raw_json.video_coin_count` | 概览卡片 | - |
| 弹幕数 | `raw_json.video_danmaku` | 概览卡片 | - |
| 互动率 | 本地计算 | 散点图 / 排行表 | ✅ |
| 发布时间 | `created_at` | 柱状图（小时分布） | ✅ |
| 内容分类 | `category` | 环形图 | ✅ |
| 标题长度 | 字符数计算 | 散点图 | - |

### UI 设计

在概览卡片上方增加维度选择器：

```
┌──────────────────────────────────────────────────────┐
│ 数据分析                      [B站 ▾]  [爬取] [AI分析] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 数据维度：                                        │
│  [✓播放量] [✓点赞] [✓评论] [粉丝数] [收藏] [投币]      │
│  [弹幕] [✓互动率] [✓发布时间] [✓分类] [标题长度]        │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 总播放    │ │ 总点赞    │ │ 粉丝数    │ │ 平均互动率│ │
│  │ 206.7万  │ │ 4.1万    │ │ 1.2万    │ │ 8.5%    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                      │
│  [📈 播放趋势] [🍩 分类占比] [📊 发布时间] [🎯 雷达图]  │
│  ┌─────────────────────────────────────────────────┐ │
│  │              图表区域（根据选中的图表Tab）          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [📋 数据表格] [🏆 互动排行] [💡 AI 洞察]              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 实现

维度选择用 toggle 按钮组：

```tsx
const [selectedDimensions, setSelectedDimensions] = useState<string[]>([
  'play_count', 'like_count', 'comment_count', 'total_fans',
  'engagement_rate', 'publish_time', 'category',
])

const DIMENSIONS = [
  { key: 'play_count', label: '播放量', icon: 'play_circle' },
  { key: 'like_count', label: '点赞数', icon: 'thumb_up' },
  { key: 'comment_count', label: '评论数', icon: 'comment' },
  { key: 'share_count', label: '分享数', icon: 'share' },
  { key: 'total_fans', label: '粉丝数', icon: 'group' },
  { key: 'favorite_count', label: '收藏数', icon: 'bookmark' },
  { key: 'coin_count', label: '投币数', icon: 'paid' },
  { key: 'danmaku', label: '弹幕数', icon: 'subtitles' },
  { key: 'engagement_rate', label: '互动率', icon: 'trending_up' },
  { key: 'publish_time', label: '发布时间', icon: 'schedule' },
  { key: 'category', label: '内容分类', icon: 'category' },
  { key: 'title_length', label: '标题长度', icon: 'text_fields' },
]

// 概览卡片根据选中维度动态显示
const overviewCards = DIMENSIONS
  .filter(d => selectedDimensions.includes(d.key))
  .slice(0, 6)  // 最多显示 6 个卡片
  .map(d => ({
    ...d,
    value: computedValues[d.key],  // 从数据计算
  }))
```

---

## 三、粉丝数展示

### 数据来源

粉丝数存在 `creators` 表的 `total_fans` 字段中，由 MediaCrawler 爬取创作者主页时写入。

### 展示

1. **概览卡片**：新增"粉丝数"卡片，显示 `creators.total_fans`
2. **趋势图**：如果有多次爬取记录，按时间展示粉丝数变化（折线图）
3. **创作者详情头部**：在 DataView 的创作者头部区域显示粉丝数

```tsx
{/* 创作者头部 */}
<div className="bg-surface-container rounded-xl p-5 flex items-center gap-4">
  <Avatar src={currentSource.avatarUrl} name={currentSource.sourceName} size={48} />
  <div className="flex-1">
    <h2 className="text-lg font-medium text-on-surface">{currentSource.sourceName}</h2>
    <p className="text-[11px] text-mute">
      UID: {currentSource.sourceUid} · {currentSource.count} 个视频
      {currentSource.fans && ` · ${formatNumber(currentSource.fans)} 粉丝`}
    </p>
  </div>
</div>
```

需要修改 `getSourceList` 返回 `total_fans`：

```javascript
// db/index.js getSourceList 中
const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned FROM creators')
// 改为
const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned, total_fans FROM creators')
```

---

## 四、下钻查看（单条数据详情）

### 目标

用户点击视频列表中的某一条，弹出详情面板，显示该视频的所有数据。

### 交互

点击视频行 → 右侧滑出详情面板：

```
┌──────────────────────────────────────┐
│ 📹 视频详情                    [✕]   │
├──────────────────────────────────────┤
│                                      │
│ 标题：第一支视频求三连！              │
│ 作者：440609243                      │
│ 分类：未分类                          │
│ 发布时间：2026-05-20                 │
│                                      │
│ ─── 数据指标 ───                     │
│ 播放量    1                          │
│ 点赞数    0                          │
│ 评论数    0                          │
│ 分享数    0                          │
│ 收藏数    0                          │
│ 投币数    0                          │
│ 弹幕数    0                          │
│ 互动率    0%                         │
│                                      │
│ ─── 简介 ───                         │
│ 视频简介文本...                      │
│                                      │
│ [📝 修改分类]  [📋 复制标题]  [🔗 打开链接]│
│                                      │
└──────────────────────────────────────┘
```

### 实现

```tsx
const [selectedVideo, setSelectedVideo] = useState<CrawlContent | null>(null)

// 视频列表行点击
<tr onClick={() => setSelectedVideo(v)} className="cursor-pointer hover:bg-surface-high/50">

// 详情面板
{selectedVideo && (
  <VideoDetailPanel video={selectedVideo} onClose={() => setSelectedVideo(null)} />
)}
```

---

## 五、数据导出（多格式）

### 目标

支持将数据导出为 CSV、Markdown、TXT 三种格式。

### 导出范围

1. **当前视图数据**：只导出筛选后的数据
2. **分析结果**：AI 分析的 JSON 结果
3. **全部数据**：该来源的所有视频数据

### 导出按钮位置

在数据表格/排行榜区域的右上角：

```
[📥 导出 ▾]
  ├── 导出为 CSV
  ├── 导出为 Markdown
  └── 导出为 TXT
```

### 各格式模板

**CSV**：

```csv
标题,作者,播放量,点赞数,评论数,分享数,分类,发布时间
第一支视频求三连！,440609243,1,0,0,0,未分类,2026-05-20
```

**Markdown**：

```markdown
# 数据导出 - B站 - 440609243
导出时间：2025-05-25

## 概览
- 视频总数：73
- 总播放量：206.7万
- 总点赞数：4.1万
- 粉丝数：1.2万

## 视频列表

| # | 标题 | 播放 | 点赞 | 评论 | 分类 |
|---|------|------|------|------|------|
| 1 | 第一支视频求三连！ | 1 | 0 | 0 | 未分类 |
```

**TXT**：

```
数据导出 - B站 - 440609243
导出时间：2025-05-25

概览：
  视频总数：73
  总播放量：206.7万

视频列表：
  1. 第一支视频求三连！ | 播放:1 | 点赞:0
  2. 第一次在B站发视频 | 播放:5 | 点赞:0
```

### 实现

```tsx
const handleExport = (format: 'csv' | 'md' | 'txt') => {
  const data = filteredVideos  // 当前筛选后的数据
  const overview = localStats?.overview

  let content = ''
  let filename = ''
  let mimeType = ''

  if (format === 'csv') {
    content = generateCSV(data, overview)
    filename = `${currentSource?.sourceName || 'data'}_${Date.now()}.csv`
    mimeType = 'text/csv;charset=utf-8'
  } else if (format === 'md') {
    content = generateMarkdown(data, overview, analysis)
    filename = `${currentSource?.sourceName || 'data'}_${Date.now()}.md`
    mimeType = 'text/markdown;charset=utf-8'
  } else {
    content = generateTXT(data, overview)
    filename = `${currentSource?.sourceName || 'data'}_${Date.now()}.txt`
    mimeType = 'text/plain;charset=utf-8'
  }

  const blob = new Blob(['\uFEFF' + content], { type: mimeType })  // BOM for Excel
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function generateCSV(videos: CrawlContent[], overview?: any) {
  const header = '标题,作者,播放量,点赞数,评论数,分享数,分类,发布时间'
  const rows = videos.map(v =>
    `"${(v.title || '').replace(/"/g, '""')}","${v.authorName || ''}",${v.playCount},${v.likeCount},${v.commentCount},${v.shareCount},"${v.category || '未分类'}","${v.createdAt || ''}"`
  )
  return [header, ...rows].join('\n')
}

function generateMarkdown(videos: CrawlContent[], overview?: any, analysis?: VideoAnalysis) {
  let md = `# 数据导出\n\n`
  if (overview) {
    md += `## 概览\n`
    md += `- 视频总数：${overview.totalVideos}\n`
    md += `- 总播放量：${formatNumber(overview.totalPlay)}\n`
    md += `- 总点赞数：${formatNumber(overview.totalLike)}\n\n`
  }
  md += `## 视频列表\n\n`
  md += `| # | 标题 | 播放 | 点赞 | 评论 | 分类 |\n`
  md += `|---|------|------|------|------|------|\n`
  videos.forEach((v, i) => {
    md += `| ${i+1} | ${v.title || '-'} | ${formatNumber(v.playCount)} | ${formatNumber(v.likeCount)} | ${v.commentCount} | ${v.category || '未分类'} |\n`
  })
  if (analysis?.suggestions) {
    md += `\n## AI 建议\n\n`
    analysis.suggestions.forEach(s => { md += `- ${s}\n` })
  }
  return md
}

function generateTXT(videos: CrawlContent[], overview?: any) {
  let txt = `数据导出\n${'='.repeat(40)}\n\n`
  if (overview) {
    txt += `概览：\n`
    txt += `  视频总数：${overview.totalVideos}\n`
    txt += `  总播放量：${formatNumber(overview.totalPlay)}\n`
    txt += `  总点赞数：${formatNumber(overview.totalLike)}\n\n`
  }
  txt += `视频列表：\n`
  videos.forEach((v, i) => {
    txt += `  ${i+1}. ${v.title || '-'} | 播放:${v.playCount} | 点赞:${v.likeCount}\n`
  })
  return txt
}
```

---

## 六、图表 Tab 切换

在概览卡片下方增加图表区域，用 Tab 切换不同图表：

```tsx
const [activeChart, setActiveChart] = useState('trend')

const charts = [
  { key: 'trend', label: '播放趋势', icon: 'show_chart' },
  { key: 'category', label: '分类占比', icon: 'pie_chart' },
  { key: 'time', label: '发布时间', icon: 'schedule' },
  { key: 'radar', label: '综合评分', icon: 'radar' },
  { key: 'scatter', label: '标题分析', icon: 'scatter_plot' },
]

{/* 图表 Tab */}
<div className="flex gap-1 mb-4">
  {charts.map(c => (
    <button key={c.key} onClick={() => setActiveChart(c.key)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-full transition-colors ${
        activeChart === c.key ? 'bg-primary/20 text-primary' : 'bg-surface-container text-mute hover:text-on-surface'
      }`}>
      <span className="material-symbols-outlined text-[14px]">{c.icon}</span>
      {c.label}
    </button>
  ))}
</div>

{/* 图表区域 */}
<div className="bg-surface-container rounded-xl p-5 mb-5">
  {activeChart === 'trend' && <TrendChart data={videos} />}
  {activeChart === 'category' && <CategoryChart data={videos} />}
  {activeChart === 'time' && <TimeChart data={videos} />}
  {activeChart === 'radar' && <RadarChart stats={localStats} />}
  {activeChart === 'scatter' && <ScatterChart data={videos} />}
</div>
```

### 各图表组件

```tsx
// 播放趋势折线图
function TrendChart({ data }: { data: CrawlContent[] }) {
  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.map(v => v.createdAt?.slice(0, 10) || ''),
      ...darkTheme.xAxis,
    },
    yAxis: { type: 'value', ...darkTheme.yAxis },
    series: [{
      type: 'line',
      data: data.map(v => v.playCount),
      smooth: true,
      areaStyle: { opacity: 0.1 },
      itemStyle: { color: '#6bfb9a' },
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}

// 分类占比环形图
function CategoryChart({ data }: { data: CrawlContent[] }) {
  const catMap: Record<string, number> = {}
  data.forEach(v => { catMap[v.category || '未分类'] = (catMap[v.category || '未分类'] || 0) + 1 })
  const option = {
    ...darkTheme,
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: Object.entries(catMap).map(([name, value]) => ({ name, value })),
      label: { color: '#bccabb' },
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}

// 发布时间分布柱状图
function TimeChart({ data }: { data: CrawlContent[] }) {
  const hourMap: Record<number, number> = {}
  data.forEach(v => {
    if (v.createdAt) {
      const hour = new Date(v.createdAt).getHours()
      hourMap[hour] = (hourMap[hour] || 0) + 1
    }
  })
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const option = {
    ...darkTheme,
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: hours.map(h => `${h}时`), ...darkTheme.xAxis },
    yAxis: { type: 'value', ...darkTheme.yAxis },
    series: [{
      type: 'bar',
      data: hours.map(h => hourMap[h] || 0),
      itemStyle: { color: '#6bfb9a', borderRadius: [4, 4, 0, 0] },
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}

// 综合评分雷达图
function RadarChart({ stats }: { stats: any }) {
  if (!stats) return <p className="text-sm text-mute text-center py-8">暂无数据</p>
  const option = {
    ...darkTheme,
    radar: {
      indicator: [
        { name: '播放量', max: Math.max(stats.overview.totalPlay, 1) },
        { name: '点赞数', max: Math.max(stats.overview.totalLike, 1) },
        { name: '评论数', max: Math.max(stats.overview.totalComment, 1) },
        { name: '互动率', max: 100 },
        { name: '更新频率', max: 30 },
      ],
      axisName: { color: '#bccabb' },
      splitArea: { areaStyle: { color: ['transparent'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [
          stats.overview.totalPlay,
          stats.overview.totalLike,
          stats.overview.totalComment,
          stats.topByEngagement?.[0]?.engagementRate || 0,
          stats.overview.totalVideos,
        ],
        areaStyle: { opacity: 0.2 },
        itemStyle: { color: '#6bfb9a' },
      }],
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}

// 标题长度 vs 播放量散点图
function ScatterChart({ data }: { data: CrawlContent[] }) {
  const option = {
    ...darkTheme,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `标题长度: ${p.data[0]}字<br/>播放量: ${p.data[1]}`,
    },
    xAxis: { type: 'value', name: '标题长度（字）', ...darkTheme.xAxis },
    yAxis: { type: 'value', name: '播放量', ...darkTheme.yAxis },
    series: [{
      type: 'scatter',
      data: data.map(v => [(v.title || '').length, v.playCount]),
      symbolSize: 8,
      itemStyle: { color: '#6bfb9a', opacity: 0.7 },
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}
```

---

## 改动文件

| 文件 | 改动 |
|---|---|
| `package.json` | 新增 echarts + echarts-for-react 依赖 |
| `src/components/DataView.tsx` | 重写布局 + 图表 + 维度选择 + 下钻 + 导出 |
| `src/lib/chartTheme.ts` | 新建，ECharts 暗色主题配置 |
| `src/components/data/TrendChart.tsx` | 新建 |
| `src/components/data/CategoryChart.tsx` | 新建 |
| `src/components/data/TimeChart.tsx` | 新建 |
| `src/components/data/RadarChart.tsx` | 新建 |
| `src/components/data/ScatterChart.tsx` | 新建 |
| `src/components/data/VideoDetailPanel.tsx` | 新建，下钻详情面板 |
| `src/components/data/ExportMenu.tsx` | 新建，导出菜单 |
| `knower-agent/db/index.js` | `getSourceList` 返回 `total_fans` |

---

## 验收标准

### 图表

- [ ] 播放趋势折线图正常显示
- [ ] 分类占比环形图正常显示
- [ ] 发布时间柱状图正常显示
- [ ] 综合评分雷达图正常显示
- [ ] 标题长度散点图正常显示
- [ ] 所有图表支持暗色主题
- [ ] 图表 Tab 切换正常

### 维度选择

- [ ] 维度选择器显示所有维度（播放/点赞/评论/分享/粉丝/收藏/投币/弹幕/互动率/时间/分类/标题长度）
- [ ] 点击维度 toggle 控制概览卡片显隐
- [ ] 最多显示 6 个概览卡片

### 粉丝数

- [ ] 概览卡片显示粉丝数（来自 creators 表）
- [ ] 创作者详情头部显示粉丝数

### 下钻

- [ ] 点击视频行弹出详情面板
- [ ] 详情面板显示完整数据指标
- [ ] 支持修改分类、复制标题

### 导出

- [ ] CSV 导出：数据完整，Excel 可打开（有 BOM）
- [ ] Markdown 导出：含概览 + 表格 + AI 建议
- [ ] TXT 导出：纯文本格式
- [ ] 导出的是当前筛选后的数据

---

*知更 Knower · 数据分析页改版提示词*
