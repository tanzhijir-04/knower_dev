# 给 CC 的提示词：全站 UI 重构（基于 Cursor 设计规范）

## 背景

知更 Knower 的 UI 要从当前的暗绿色主题全面切换为 Cursor 风格的设计语言。核心变化：**暖色奶油底 + 发丝线深度 + 杂志感排版 + 单色强调**。

参考文档：`docs/cursor_style_design.md`

---

## 一、设计 Token 全量替换

### 1.1 色彩体系

**`tailwind.config.js`** 完全重写 colors：

```javascript
colors: {
  // 核心
  primary: '#f54e00',           // Knower Orange（替代 Cursor Orange）
  'primary-active': '#d04200',
  'on-primary': '#ffffff',

  // 画布
  canvas: '#f7f7f4',           // 暖奶油底（默认背景）
  'canvas-soft': '#fafaf7',    // IDE 面板背景

  // 表面
  surface: '#ffffff',           // 卡片表面（白底，微弱对比奶油）
  'surface-strong': '#e6e5e0', // 徽章、标签
  'surface-low': '#fafaf7',    // 输入框背景

  // 发丝线
  hairline: '#e6e5e0',         // 1px 分割线
  'hairline-soft': '#efeee8',  // 更浅
  'hairline-strong': '#cfcdc4', // 更强

  // 文字
  ink: '#26251e',              // 标题、强调（暖近黑）
  body: '#5a5852',             // 正文
  'body-strong': '#26251e',    // 同 ink
  muted: '#807d72',            // 副标题
  'muted-soft': '#a09c92',     // 禁用文字

  // AI 时间线（仅用于 Agent 工具调用状态）
  'timeline-thinking': '#dfa88f',  // 桃色 - 思考中
  'timeline-grep': '#9fc9a2',      // 薄荷 - 搜索
  'timeline-read': '#9fbbe0',      // 浅蓝 - 读取
  'timeline-edit': '#c0a8dd',      // 薰衣草 - 编辑
  'timeline-done': '#c08532',      // 暖金 - 完成

  // 语义
  'semantic-success': '#1f8a65',
  'semantic-error': '#cf2d56',

  // 兼容旧名（过渡期保留，后续逐步替换）
  background: '#f7f7f4',
  'on-surface': '#26251e',
  'on-surface-variant': '#5a5852',
  'outline-variant': '#e6e5e0',
  border: '#e6e5e0',
  mute: '#807d72',
  sidebar: '#fafaf7',
}
```

### 1.2 字体体系

**`index.html`** 修改字体加载：

```html
<!-- 旧：JetBrains Mono 做所有文字 -->
<!-- 新：Inter 做 UI 文字，JetBrains Mono 仅代码 -->

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

去掉 Source Serif 4（Cursor 风格不用衬线体做 display）。

**`tailwind.config.js`** 修改 fontFamily：

```javascript
fontFamily: {
  sans: [
    'Inter',
    'Noto Sans SC',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'sans-serif',
  ],
  mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
}
```

**关键原则（从 Cursor 规范）**：
- Display 字重永远 400，不用 bold
- Display 加负字间距（letter-spacing: -0.5% ~ -3%）
- 只有代码表面用 JetBrains Mono

**`index.css`** 新增字体层级：

```css
/* Display 字体（标题、产品名） */
.text-display-lg {
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: -0.72px;
  color: var(--ink);
}
.text-display-md {
  font-size: 26px;
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: -0.325px;
  color: var(--ink);
}
.text-display-sm {
  font-size: 22px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: -0.11px;
  color: var(--ink);
}

/* Body 字体 */
.text-body { font-size: 16px; font-weight: 400; line-height: 1.5; color: var(--body); }
.text-body-sm { font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--body); }
.text-caption { font-size: 13px; font-weight: 400; line-height: 1.4; color: var(--muted); }
.text-caption-upper {
  font-size: 11px; font-weight: 600; line-height: 1.4;
  letter-spacing: 0.88px; text-transform: uppercase; color: var(--muted);
}

/* 代码字体 */
.text-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 400; line-height: 1.5;
}
```

### 1.3 间距体系

基于 Cursor 的 4px 网格：

```javascript
spacing: {
  'xxs': '4px',
  'xs': '8px',
  'sm': '12px',
  'base': '16px',
  'md': '20px',
  'lg': '24px',
  'xl': '32px',
  'xxl': '48px',
  'section': '80px',
}
```

### 1.4 圆角体系

```javascript
borderRadius: {
  none: '0px',
  xs: '4px',      // 内联标签
  sm: '6px',      // 紧凑行
  md: '8px',      // CTA 按钮、表单输入
  lg: '12px',     // 卡片（主力）
  xl: '16px',     // 大卡片（少用）
  pill: '9999px', // 时间线胶囊、徽章
  full: '9999px', // 头像
}
```

---

## 二、全局样式重写

### 2.1 `index.css` 全量替换

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f7f7f4;        /* 暖奶油底 */
    color: #26251e;              /* 暖近黑墨色 */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    overflow: hidden;
  }

  /* 滚动条 — 极简发丝线风格 */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cfcdc4; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #807d72; }

  /* Material Symbols */
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
}

@layer components {
  /* ========== 卡片 ========== */
  .card {
    background: #ffffff;
    border: 1px solid #e6e5e0;
    border-radius: 12px;
    padding: 24px;
  }
  .card-sm {
    background: #ffffff;
    border: 1px solid #e6e5e0;
    border-radius: 12px;
    padding: 16px 20px;
  }

  /* ========== 按钮 ========== */
  .btn-primary {
    background: #f54e00;
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.0;
    padding: 10px 18px;
    height: 40px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover { background: #d04200; }
  .btn-primary:active { background: #b03800; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-secondary {
    background: #ffffff;
    color: #26251e;
    font-size: 14px;
    font-weight: 500;
    padding: 10px 18px;
    height: 40px;
    border-radius: 8px;
    border: 1px solid #cfcdc4;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-secondary:hover { background: #fafaf7; }

  .btn-ghost {
    background: transparent;
    color: #5a5852;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }
  .btn-ghost:hover { background: #e6e5e0; color: #26251e; }

  /* ========== 表单输入 ========== */
  .input {
    background: #ffffff;
    color: #26251e;
    border: 1px solid #e6e5e0;
    border-radius: 8px;
    padding: 12px 16px;
    height: 44px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  .input:focus { border-color: #cfcdc4; }
  .input::placeholder { color: #a09c92; }

  .textarea {
    background: #ffffff;
    color: #26251e;
    border: 1px solid #e6e5e0;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    outline: none;
    resize: none;
    transition: border-color 0.15s;
  }
  .textarea:focus { border-color: #cfcdc4; }

  /* ========== 导航项 ========== */
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #5a5852;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .nav-item:hover { background: #e6e5e0; color: #26251e; }
  .nav-item.active { background: #e6e5e0; color: #f54e00; }

  /* ========== 时间线胶囊 ========== */
  .pill-thinking { background: #dfa88f; color: #26251e; }
  .pill-grep { background: #9fc9a2; color: #26251e; }
  .pill-read { background: #9fbbe0; color: #26251e; }
  .pill-edit { background: #c0a8dd; color: #26251e; }
  .pill-done { background: #c08532; color: #ffffff; }

  .timeline-pill {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.88px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 9999px;
  }

  /* ========== 徽章 ========== */
  .badge {
    background: #e6e5e0;
    color: #26251e;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.88px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 9999px;
  }

  /* ========== 分割线 ========== */
  .hairline { border-bottom: 1px solid #e6e5e0; }
  .hairline-soft { border-bottom: 1px solid #efeee8; }

  /* ========== 代码块 ========== */
  .code-block {
    background: #ffffff;
    color: #26251e;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid #e6e5e0;
    border-radius: 12px;
    padding: 20px;
  }

  /* ========== 动画 ========== */
  @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
  .animate-spin { animation: spin 1s linear infinite; }
  .typing-cursor::after { content: '█'; color: #f54e00; animation: blink 0.8s step-end infinite; margin-left: 1px; }
}
```

### 2.2 CSS 变量

在 `index.css` 的 `:root` 中：

```css
:root {
  --canvas: #f7f7f4;
  --canvas-soft: #fafaf7;
  --surface: #ffffff;
  --surface-strong: #e6e5e0;
  --hairline: #e6e5e0;
  --hairline-soft: #efeee8;
  --hairline-strong: #cfcdc4;
  --ink: #26251e;
  --body: #5a5852;
  --muted: #807d72;
  --muted-soft: #a09c92;
  --primary: #f54e00;
  --primary-active: #d04200;
  --on-primary: #ffffff;
}
```

---

## 三、核心组件重写

### 3.1 侧边栏（Sidebar.tsx）

**当前**：深色背景（`bg-sidebar`），绿色高亮。
**目标**：奶油色背景，发丝线边框，橙色高亮。

```tsx
<aside className="h-full bg-canvas-soft border-r border-hairline flex flex-col shrink-0" style={{ width }}>
  {/* Logo */}
  <div className="flex items-center gap-3 px-5 py-5 border-b border-hairline">
    <img src={logoSvg} className="w-8 h-8 rounded-lg shrink-0" />
    {!collapsed && (
      <span className="text-display-sm" style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-0.11px' }}>
        知更 Knower
      </span>
    )}
  </div>

  {/* 导航 */}
  <nav className="flex flex-col gap-0.5 px-3 pt-4">
    {navItems.map(item => (
      <button key={item.id} onClick={() => onNavigate(item.id)}
        className={`nav-item ${currentPage === item.id ? 'active' : ''}`}>
        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
      </button>
    ))}
  </nav>

  {/* 搜索 + 对话历史 */}
  {!collapsed && (
    <div className="flex-1 flex flex-col mt-4 overflow-hidden px-3">
      <input className="input mb-3" placeholder="搜索对话..." style={{ height: 36, fontSize: 13, padding: '8px 12px' }} />
      <span className="text-caption-upper mb-2 px-1">最近对话</span>
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <button key={conv.id} className="nav-item text-[13px]">
            <span className="material-symbols-outlined text-[16px] text-muted">chat_bubble</span>
            <span className="truncate flex-1">{conv.title}</span>
          </button>
        ))}
      </div>
    </div>
  )}

  {/* 底部：主题切换 + 折叠 */}
  <div className="px-3 py-3 border-t border-hairline">
    {!collapsed && (
      <div className="flex items-center justify-center gap-1 mb-2">
        {/* 主题按钮 */}
      </div>
    )}
    <button onClick={() => setCollapsed(!collapsed)} className="nav-item justify-center">
      <span className={`material-symbols-outlined text-[18px] transition-transform ${collapsed ? 'rotate-180' : ''}`}>
        chevron_left
      </span>
    </button>
  </div>
</aside>
```

### 3.2 创作台消息

**当前**：深色气泡。
**目标**：奶油底 + 白色卡片。

```tsx
{/* 用户消息 — 右对齐，白色卡片 */}
<div className="flex justify-end mb-6">
  <div className="max-w-[75%] bg-surface border border-hairline rounded-lg px-4 py-3 text-body">
    {msg.content}
  </div>
</div>

{/* 助手消息 — 左对齐，全宽 */}
<div className="flex justify-start mb-6">
  <div className="max-w-full">
    {/* 工具调用时间线 */}
    {msg.toolCalls?.map(tc => (
      <div key={tc.name} className="flex items-center gap-2 mb-2">
        <span className={`timeline-pill pill-${tc.status === 'running' ? 'thinking' : tc.status === 'success' ? 'done' : 'edit'}`}>
          {tc.status === 'running' ? 'Thinking' : tc.status === 'success' ? 'Done' : 'Error'}
        </span>
        <span className="text-caption">{tc.label}</span>
        <span className="text-muted-soft text-[12px]">{tc.duration}s</span>
      </div>
    ))}
    {/* 文本内容 */}
    <div className="text-body leading-relaxed">{msg.textContent}</div>
    {/* 物料面板 */}
    {msg.materialData && <MaterialPanel data={msg.materialData} />}
    {/* 操作栏 */}
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="btn-ghost text-[12px]">👍</button>
      <button className="btn-ghost text-[12px]">👎</button>
      <button className="btn-ghost text-[12px]">📋 复制</button>
      <button className="btn-ghost text-[12px]">🔄 重试</button>
    </div>
  </div>
</div>
```

### 3.3 工具调用时间线（AI Timeline）

**这是 Cursor 的标志性设计**。Agent 工具调用用彩色胶囊标记阶段：

```tsx
function ToolTimeline({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  const statusMap: Record<string, { pill: string; label: string }> = {
    running: { pill: 'pill-thinking', label: 'Thinking' },
    success: { pill: 'pill-done', label: 'Done' },
    error: { pill: 'pill-edit', label: 'Error' },
    crawling: { pill: 'pill-grep', label: 'Crawling' },
    querying: { pill: 'pill-read', label: 'Querying' },
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {toolCalls.map((tc, i) => {
        const s = statusMap[tc.status] || statusMap.running
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-soft">→</span>}
            <span className={`timeline-pill ${s.pill}`}>{s.label}</span>
            <span className="text-caption">{tc.name}</span>
          </div>
        )
      })}
    </div>
  )
}
```

### 3.4 概览卡片

```tsx
function OverviewCard({ icon, label, value, suffix }: {
  icon: string; label: string; value: number; suffix?: string
}) {
  return (
    <div className="card-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="material-symbols-outlined text-[14px] text-primary">{icon}</span>
        <span className="text-caption">{label}</span>
      </div>
      <p className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-0.11px' }}>
        {formatNumber(value)}{suffix || ''}
      </p>
    </div>
  )
}
```

### 3.5 输入框

```tsx
{/* 输入区域 */}
<div className="px-4 pb-4 max-w-3xl mx-auto">
  <div className="relative">
    <textarea
      className="textarea w-full pr-12"
      placeholder="输入消息给知更 AI..."
      rows={1}
      style={{ minHeight: 44, maxHeight: 120 }}
    />
    <button className="btn-primary absolute right-2 bottom-2" style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}>
      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
    </button>
  </div>

  {/* 快捷操作 */}
  <div className="flex items-center gap-1.5 mt-2">
    <button className="btn-ghost text-[12px]">
      <span className="material-symbols-outlined text-[14px] mr-1">auto_awesome</span>生成物料
    </button>
    <button className="btn-ghost text-[12px]">
      <span className="material-symbols-outlined text-[14px] mr-1">analytics</span>分析数据
    </button>
    <button className="btn-ghost text-[12px]">
      <span className="material-symbols-outlined text-[14px] mr-1">lightbulb</span>选题建议
    </button>
  </div>
</div>
```

### 3.6 欢迎页

```tsx
<div className="flex flex-col items-center justify-center h-full px-6">
  <div className="max-w-lg text-center">
    <img src={logoSvg} className="w-16 h-16 mx-auto mb-6 rounded-2xl" />
    <h1 className="text-display-lg mb-2">知更 Knower</h1>
    <p className="text-body mb-8">让创作者比平台更早知道下一步该做什么</p>

    {/* 快速开始卡片 */}
    <button className="card w-full text-left mb-4 hover:border-primary/30 transition-colors group">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
        <div>
          <p className="text-body-sm font-medium text-ink group-hover:text-primary transition-colors">粘贴脚本，一键生成物料</p>
          <p className="text-caption">支持 B站 / YouTube / 抖音 / 小红书</p>
        </div>
      </div>
    </button>

    {/* 快捷操作 */}
    <div className="flex gap-3 justify-center">
      <button className="card-sm flex items-center gap-2 hover:border-primary/30 transition-colors">
        <span className="material-symbols-outlined text-[16px] text-primary">analytics</span>
        <span className="text-body-sm">查看数据</span>
      </button>
      <button className="card-sm flex items-center gap-2 hover:border-primary/30 transition-colors">
        <span className="material-symbols-outlined text-[16px] text-primary">settings</span>
        <span className="text-body-sm">配置 API</span>
      </button>
    </div>
  </div>
</div>
```

---

## 四、Do's and Don'ts

### Do ✅

- 背景用暖奶油底 `#f7f7f4`，**永远不用纯白做页面背景**
- 卡片用白色 `#ffffff`，通过 1px 发丝线 + 白/奶油对比产生层次
- 强调色（橙色 `#f54e00`）只用在 CTA 按钮和品牌名，**克制使用**
- Display 字重永远 400，不用 bold
- Display 加负字间距
- 所有代码表面用 JetBrains Mono
- Agent 工具调用用时间线胶囊（桃/薄荷/蓝/薰衣草/金）
- 圆角：按钮 8px，卡片 12px，标签 9999px

### Don't ❌

- **不要用阴影** — 用发丝线 + 颜色对比代替
- **不要用粗体做标题** — 杂志感靠字重 400 + 字间距
- **不要引入第二种强调色** — 橙色是唯一的 CTA 色
- **不要在非时间线 UI 中使用时间线胶囊颜色**
- **不要用绿色做强调** — 当前的 `#6bfb9a` 全部替换为橙色 `#f54e00`
- **不要用深色背景做默认** — 奶油底是默认，深色模式可选

---

## 五、改动文件清单

| 文件 | 改动 |
|---|---|
| `index.html` | 字体加载改为 Inter + Noto Sans SC |
| `tailwind.config.js` | colors / fontFamily / spacing / borderRadius 全量替换 |
| `src/index.css` | 全量重写（组件样式 + 动画 + 字体层级） |
| `src/components/Sidebar.tsx` | 重写：奶油底 + 发丝线 + 橙色高亮 |
| `src/components/ChatView.tsx` | 重写：消息气泡 + 输入框 + 欢迎页 |
| `src/components/MaterialCards.tsx` | 重写：白色卡片 + 发丝线边框 |
| `src/components/DataView.tsx` | 重写：概览卡片 + 图表容器 + 表格 |
| `src/components/SettingsView.tsx` | 重写：白色卡片 + 发丝线 |
| `src/components/TopicsView.tsx` | 重写（待开发） |
| `src/App.tsx` | 背景色改为 canvas |

---

## 六、验收标准

### 全局

- [ ] 页面背景为暖奶油色 `#f7f7f4`
- [ ] 所有卡片为白色 `#ffffff` + 1px 发丝线边框
- [ ] 无任何 drop shadow
- [ ] 强调色为橙色 `#f54e00`，仅用于 CTA 和品牌名
- [ ] 标题字重为 400（非 bold）
- [ ] 代码块使用 JetBrains Mono

### 侧边栏

- [ ] 奶油色背景，发丝线右边框
- [ ] 导航项：灰色文字，hover 变深，激活态橙色

### 创作台

- [ ] 用户消息：白色卡片 + 发丝线边框
- [ ] 助手消息：纯文本，无背景
- [ ] 工具调用：时间线胶囊（Thinking/Done/Crawling/Querying）
- [ ] 输入框：白色背景 + 发丝线边框 + 橙色发送按钮

### 数据分析

- [ ] 概览卡片：白色 + 发丝线
- [ ] 图表容器：白色卡片
- [ ] 表格：发丝线分割行

### 设置页

- [ ] 白色卡片 + 发丝线
- [ ] 保存按钮：橙色 CTA

---

*知更 Knower · 全站 UI 重构提示词（Cursor 风格）*
