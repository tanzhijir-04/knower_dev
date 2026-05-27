# 给 CC 的提示词：数据分析页完全重写

## 背景

当前数据分析页问题严重：
1. 浅色模式配色刺眼，绿色在白底上对比度差
2. 粉丝数显示 0，数据没正确读取
3. 数据维度缺失，只有 5 个卡片
4. 图表没有卡片容器，看起来悬浮
5. 视频列表/数据表格不见了
6. 导出按钮缺失
7. 维度选择器缺失
8. 布局太稀疏，信息密度低

**需要完全重写 `src/components/DataView.tsx` 及相关组件。**

---

## 一、配色问题修复

### 根因

浅色模式下 `--primary: #0d9e4f` 在白底上不够突出，整体发灰。图表区域没有背景色区分。

### 修复方案

**a) 浅色模式配色调整（`index.css`）**：

```css
.theme-light {
  --bg: #f5f5f5;
  --surface: #ffffff;
  --surface-low: #fafafa;
  --surface-container: #f0f0f0;
  --surface-high: #e8e8e8;
  --on-surface: #1a1a1a;
  --on-surface-variant: #555555;
  --outline-variant: #d0d0d0;
  --primary: #0a7e3c;           /* 加深绿色，白底上更清晰 */
  --primary-light: #e8f5e9;     /* primary 的浅色背景 */
  --mute: #999999;
}
```

**b) 图表区域加卡片背景**：

所有图表容器必须有：
```css
.chart-card {
  background: var(--surface);
  border: 1px solid var(--outline-variant);
  border-radius: 12px;
  padding: 20px;
}
```

**c) 概览卡片加微弱阴影**：

```css
.overview-card {
  background: var(--surface);
  border: 1px solid var(--outline-variant);
  border-radius: 12px;
  padding: 16px 20px;
}
```

---

## 二、粉丝数修复

### 根因

`getSourceList` 返回的数据中没有 `total_fans`，概览卡片直接读 `overview.fans` 显示 0。

### 修复

**a) `knower-agent/db/index.js` 的 `getSourceList`**：

```javascript
// 旧
const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned FROM creators')

// 新
const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned, total_fans FROM creators')
```

返回值中加 `fans`：

```javascript
return {
  sourceUid: uid,
  sourceName: row[1] || '未知来源',
  count: row[2],
  type: isKeyword ? 'keyword' : (uid ? 'creator' : 'unknown'),
  avatarUrl: creator?.avatarUrl || '',
  isStarred: creator?.isStarred || 0,
  isPinned: creator?.isPinned || 0,
  fans: creator?.fans || 0,  // 新增
}
```

**b) DataView 概览卡片读取粉丝数**：

```tsx
const OverviewCards = ({ overview, fans }: { overview: VideoAnalysis['overview']; fans?: number }) => {
  const cards = [
    { label: '总播放量', value: overview.totalPlay, icon: 'play_circle', color: '#6bfb9a' },
    { label: '总点赞数', value: overview.totalLike, icon: 'thumb_up', color: '#4ade80' },
    { label: '总评论数', value: overview.totalComment, icon: 'comment', color: '#22c55e' },
    { label: '粉丝数', value: fans || 0, icon: 'group', color: '#86efac' },
    { label: '平均播放', value: overview.avgPlay, icon: 'trending_up', color: '#34d399' },
    { label: '平均点赞', value: overview.avgLike, icon: 'favorite', color: '#10b981' },
  ]
  // ...
}
```

**c) `analyze-video-data` handler 返回粉丝数**：

```typescript
// main.ts analyze-video-data handler 末尾
const creators = await db.getCreators()
const matchingCreator = creators.find((c: any) => {
  const sourceUid = sourceUid || ''
  return c.uid === sourceUid || sourceUid.startsWith(c.uid)
})

return {
  overview: {
    totalVideos: enriched.length,
    totalPlay,
    totalLike,
    totalComment,
    avgPlay,
    avgLike,
  },
  fans: matchingCreator?.totalFans || 0,  // 新增
  topByEngagement: ...,
  ...analysis,
}
```

---

## 三、数据维度补全

### 目标

概览卡片显示 8 个维度，用户可选择显示哪些。

### 维度列表

| 维度 | 数据来源 | 卡片图标 |
|---|---|---|
| 总播放量 | `play_count` 求和 | `play_circle` |
| 总点赞数 | `like_count` 求和 | `thumb_up` |
| 总评论数 | `comment_count` 求和 | `comment` |
| 总分享数 | `share_count` 求和 | `share` |
| 粉丝数 | `creators.total_fans` | `group` |
| 收藏数 | `raw_json.video_favorite_count` 求和 | `bookmark` |
| 投币数 | `raw_json.video_coin_count` 求和 | `paid` |
| 弹幕数 | `raw_json.video_danmaku` 求和 | `subtitles` |
| 平均播放 | 总播放 / 视频数 | `trending_up` |
| 平均互动率 | 本地计算 | `analytics` |

### `analyze-video-data` 返回完整统计

```typescript
const enriched = videos.map((v) => {
  const raw = (v.rawJson || {}) as Record<string, string>
  return {
    title: v.title as string,
    playCount: v.playCount as number,
    likeCount: v.likeCount as number,
    commentCount: v.commentCount as number,
    shareCount: v.shareCount as number,
    coinCount: parseInt(raw.video_coin_count) || 0,
    favoriteCount: parseInt(raw.video_favorite_count) || 0,
    danmaku: parseInt(raw.video_danmaku) || 0,
    createdAt: v.createdAt as string,
    authorName: v.authorName as string,
    desc: v.desc as string,
  }
})

const totalPlay = enriched.reduce((s, v) => s + v.playCount, 0)
const totalLike = enriched.reduce((s, v) => s + v.likeCount, 0)
const totalComment = enriched.reduce((s, v) => s + v.commentCount, 0)
const totalShare = enriched.reduce((s, v) => s + v.shareCount, 0)
const totalCoin = enriched.reduce((s, v) => s + v.coinCount, 0)
const totalFavorite = enriched.reduce((s, v) => s + v.favoriteCount, 0)
const totalDanmaku = enriched.reduce((s, v) => s + v.danmaku, 0)
const avgPlay = Math.round(totalPlay / enriched.length)
const avgLike = Math.round(totalLike / enriched.length)
const avgEngagement = enriched.length > 0
  ? enriched.reduce((s, v) => s + (v.playCount > 0 ? (v.likeCount + v.coinCount + v.favoriteCount + v.commentCount + v.danmaku) / v.playCount * 100 : 0), 0) / enriched.length
  : 0

return {
  overview: {
    totalVideos: enriched.length,
    totalPlay, totalLike, totalComment, totalShare,
    totalCoin, totalFavorite, totalDanmaku,
    avgPlay, avgLike, avgEngagement,
  },
  fans: matchingCreator?.totalFans || 0,
  topByEngagement: ...,
  ...analysis,
}
```

### 概览卡片组件

```tsx
function OverviewCards({ overview, fans }: { overview: any; fans?: number }) {
  const [selectedDims, setSelectedDims] = useState<string[]>([
    'totalPlay', 'totalLike', 'totalComment', 'fans', 'avgPlay', 'avgEngagement',
  ])

  const allDimensions = [
    { key: 'totalPlay', label: '总播放量', value: overview.totalPlay, icon: 'play_circle' },
    { key: 'totalLike', label: '总点赞数', value: overview.totalLike, icon: 'thumb_up' },
    { key: 'totalComment', label: '总评论数', value: overview.totalComment, icon: 'comment' },
    { key: 'totalShare', label: '总分享数', value: overview.totalShare, icon: 'share' },
    { key: 'fans', label: '粉丝数', value: fans || 0, icon: 'group' },
    { key: 'totalFavorite', label: '总收藏数', value: overview.totalFavorite, icon: 'bookmark' },
    { key: 'totalCoin', label: '总投币数', value: overview.totalCoin, icon: 'paid' },
    { key: 'totalDanmaku', label: '总弹幕数', value: overview.totalDanmaku, icon: 'subtitles' },
    { key: 'avgPlay', label: '平均播放', value: overview.avgPlay, icon: 'trending_up' },
    { key: 'avgEngagement', label: '平均互动率', value: overview.avgEngagement, icon: 'analytics', suffix: '%' },
  ]

  const visible = allDimensions.filter(d => selectedDims.includes(d.key))

  return (
    <div>
      {/* 维度选择器 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {allDimensions.map(d => (
          <button
            key={d.key}
            onClick={() => {
              setSelectedDims(prev =>
                prev.includes(d.key) ? prev.filter(k => k !== d.key) : [...prev, d.key]
              )
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
              selectedDims.includes(d.key)
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:border-outline-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">{d.icon}</span>
            {d.label}
          </button>
        ))}
      </div>

      {/* 卡片网格 — 最多 4 列 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {visible.map(d => (
          <div key={d.key} className="overview-card">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-primary">{d.icon}</span>
              <span className="text-[11px] text-mute">{d.label}</span>
            </div>
            <p className="text-xl font-semibold text-on-surface">
              {formatNumber(d.value)}{d.suffix || ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 四、视频列表表格

### 目标

在图表下方显示完整的视频数据表格，支持排序、筛选、分页。

### 表格设计

```
┌────┬──────────────────────────────┬───────┬──────┬──────┬──────┬──────┬──────────┬──────────┐
│ #  │ 标题                         │ 作者   │ 播放  │ 点赞  │ 评论  │ 分享  │ 分类      │ 发布时间  │
├────┼──────────────────────────────┼───────┼──────┼──────┼──────┼──────┼──────────┼──────────┤
│ 1  │ 第一支视频求三连！            │ xxx   │ 566  │ 12   │ 3    │ 1    │ 未分类    │ 05-20    │
│ 2  │ 高三牲的周日VLog             │ xxx   │ 30   │ 2    │ 0    │ 0    │ 校园生活  │ 05-18    │
│ ...│                              │       │      │      │      │      │          │          │
└────┴──────────────────────────────┴───────┴──────┴──────┴──────┴──────┴──────────┴──────────┘

共 73 条  排序：[播放量 ↓]  筛选：[全部分类 ▾]  每页：[20 ▾]
```

### 实现

```tsx
const [sortField, setSortField] = useState('playCount')
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
const [filterCategory, setFilterCategory] = useState('')
const [page, setPage] = useState(0)
const pageSize = 20

const sortedVideos = [...videos]
  .filter(v => !filterCategory || v.category === filterCategory)
  .sort((a, b) => {
    const aVal = a[sortField] || 0
    const bVal = b[sortField] || 0
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal
  })

const pagedVideos = sortedVideos.slice(page * pageSize, (page + 1) * pageSize)

{/* 表格 */}
<div className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden">
  <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
    <span className="text-sm font-medium text-on-surface flex items-center gap-2">
      <span className="material-symbols-outlined text-[16px] text-primary">video_library</span>
      数据列表（{sortedVideos.length} 条）
    </span>
    <div className="flex items-center gap-2">
      {/* 排序 */}
      <select value={sortField} onChange={e => setSortField(e.target.value)}
        className="bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1 text-[11px] text-on-surface">
        <option value="playCount">按播放量</option>
        <option value="likeCount">按点赞数</option>
        <option value="commentCount">按评论数</option>
        <option value="shareCount">按分享数</option>
        <option value="createdAt">按发布时间</option>
      </select>
      <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
        className="p-1.5 rounded-lg text-mute hover:text-on-surface hover:bg-surface-container">
        <span className="material-symbols-outlined text-[16px]">
          {sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
        </span>
      </button>
      {/* 分类筛选 */}
      <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(0) }}
        className="bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1 text-[11px] text-on-surface">
        <option value="">全部分类</option>
        {[...new Set(videos.map(v => v.category || '未分类'))].sort().map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-surface-low">
        <tr className="text-left text-mute border-b border-outline-variant/30">
          <th className="px-4 py-2.5 w-8">#</th>
          <th className="px-4 py-2.5">标题</th>
          <th className="px-4 py-2.5 w-20">作者</th>
          <th className="px-4 py-2.5 w-20 text-right cursor-pointer" onClick={() => { setSortField('playCount'); setSortDir('desc') }}>播放 ↓</th>
          <th className="px-4 py-2.5 w-16 text-right cursor-pointer" onClick={() => { setSortField('likeCount'); setSortDir('desc') }}>点赞</th>
          <th className="px-4 py-2.5 w-16 text-right">评论</th>
          <th className="px-4 py-2.5 w-16 text-right">分享</th>
          <th className="px-4 py-2.5 w-24">分类</th>
          <th className="px-4 py-2.5 w-24">发布时间</th>
        </tr>
      </thead>
      <tbody>
        {pagedVideos.map((v, i) => (
          <tr key={v.id} className="border-b border-outline-variant/20 hover:bg-surface-container/50 cursor-pointer"
              onClick={() => setSelectedVideo(v)}>
            <td className="px-4 py-2.5 text-mute">{page * pageSize + i + 1}</td>
            <td className="px-4 py-2.5 text-on-surface truncate max-w-[280px]">{v.title || '-'}</td>
            <td className="px-4 py-2.5 text-on-surface-variant truncate">{v.authorName || '-'}</td>
            <td className="px-4 py-2.5 text-right font-medium text-on-surface">{formatNumber(v.playCount)}</td>
            <td className="px-4 py-2.5 text-right text-on-surface">{formatNumber(v.likeCount)}</td>
            <td className="px-4 py-2.5 text-right text-on-surface">{v.commentCount}</td>
            <td className="px-4 py-2.5 text-right text-on-surface">{v.shareCount}</td>
            <td className="px-4 py-2.5">
              <span className="px-2 py-0.5 bg-surface-container rounded-full text-[10px] text-on-surface-variant">
                {v.category || '未分类'}
              </span>
            </td>
            <td className="px-4 py-2.5 text-mute">{formatDate(v.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* 分页 */}
  {sortedVideos.length > pageSize && (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-outline-variant/20">
      <span className="text-[11px] text-mute">
        第 {page + 1} / {Math.ceil(sortedVideos.length / pageSize)} 页
      </span>
      <div className="flex gap-1">
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
          className="px-2 py-1 text-[11px] rounded bg-surface-container text-on-surface-variant disabled:opacity-30">上一页</button>
        <button disabled={(page + 1) * pageSize >= sortedVideos.length} onClick={() => setPage(p => p + 1)}
          className="px-2 py-1 text-[11px] rounded bg-surface-container text-on-surface-variant disabled:opacity-30">下一页</button>
      </div>
    </div>
  )}
</div>
```

---

## 五、数据导出

### 按钮位置

在视频列表表格的右上角：

```tsx
{/* 导出菜单 */}
<div className="relative">
  <button onClick={() => setShowExport(!showExport)}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/30 rounded-lg text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors">
    <span className="material-symbols-outlined text-[14px]">download</span>
    导出
    <span className="material-symbols-outlined text-[14px]">expand_more</span>
  </button>
  {showExport && (
    <div className="absolute right-0 top-full mt-1 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[140px] z-20">
      <button onClick={() => { handleExport('csv'); setShowExport(false) }}
        className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">table_chart</span> CSV
      </button>
      <button onClick={() => { handleExport('md'); setShowExport(false) }}
        className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">description</span> Markdown
      </button>
      <button onClick={() => { handleExport('txt'); setShowExport(false) }}
        className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">text_snippet</span> TXT
      </button>
    </div>
  )}
</div>
```

导出函数见 `cc_dataview_overhaul.md` 中的实现（CSV/MD/TXT 生成 + BOM 处理）。

---

## 六、整体页面布局

### 目标结构

```
┌──────────────────────────────────────────────────────────┐
│ 数据分析                [B站 ▾]  [爬取] [AI分析] [AI分类]  │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  来源列表   │  ┌─────────────────────────────────────┐    │
│            │  │ 概览卡片（8维度 + 维度选择器）          │    │
│  🔍 搜索   │  └─────────────────────────────────────┘    │
│            │                                             │
│  📌 置顶   │  ┌─────────────────────────────────────┐    │
│  · UP主A  │  │ 图表 Tab（趋势/分类/时间/雷达/标题）    │    │
│            │  │ [ECharts 图表区域]                    │    │
│  👤 创作者 │  └─────────────────────────────────────┘    │
│  · UP主B  │                                             │
│  · UP主C  │  ┌─────────────────────────────────────┐    │
│            │  │ 数据表格（排序/筛选/分页/导出）          │    │
│  🔍 关键词 │  │ 视频列表 + 分页                       │    │
│  · "测评" │  └─────────────────────────────────────┘    │
│            │                                             │
│  📊 全部   │  ┌─────────────────────────────────────┐    │
│  · 全部数据│  │ AI 洞察（选题建议/内容规律/发布策略）   │    │
│            │  └─────────────────────────────────────┘    │
│            │                                             │
├────────────┴─────────────────────────────────────────────┤
│  [+ 新建爬取]                               [导出全部]    │
└──────────────────────────────────────────────────────────┘
```

### 关键改动

1. **去掉顶部拥挤的操作栏**：模式切换（关键词/用户主页）合并为一个 toggle
2. **概览卡片加维度选择器**：卡片区域上方
3. **图表区域有明确卡片边框**
4. **数据表格恢复**：排序 + 筛选 + 分页 + 点击行查看详情
5. **导出按钮**：表格右上角
6. **底部操作栏简化**：只有"新建爬取"和"导出全部"

---

## 改动文件

| 文件 | 改动 |
|---|---|
| `src/components/DataView.tsx` | 完全重写 |
| `src/index.css` | 新增 `.overview-card`、`.chart-card` 样式 |
| `knower-agent/db/index.js` | `getSourceList` 返回 `total_fans` |
| `electron/main.ts` | `analyze-video-data` 返回完整统计 + fans |

---

## 验收标准

### 配色

- [ ] 浅色模式下绿色清晰可辨，不刺眼
- [ ] 图表区域有白色卡片容器 + 圆角 + 边框
- [ ] 概览卡片有微弱边框和阴影

### 数据

- [ ] 粉丝数正确显示（非 0）
- [ ] 概览卡片显示 8+ 个维度（播放/点赞/评论/分享/粉丝/收藏/投币/弹幕）
- [ ] 平均互动率正确计算

### 交互

- [ ] 维度选择器可 toggle 各维度卡片显隐
- [ ] 视频表格可按播放量/点赞/评论排序
- [ ] 可按分类筛选
- [ ] 分页正常工作
- [ ] 点击行弹出详情面板
- [ ] 导出菜单支持 CSV/MD/TXT

### 图表

- [ ] 5 种图表正常显示（趋势/分类/时间/雷达/标题）
- [ ] 图表有卡片容器
- [ ] Tooltip 正常工作

---

*知更 Knower · 数据分析页完全重写提示词*
