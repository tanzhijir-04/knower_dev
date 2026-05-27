# 给 CC 的提示词：侧边栏动画修复 + 主题切换

## 问题 1：侧边栏展开时文字突然出现

### 现象

点击折叠按钮展开侧边栏时，导航文字（"创作台"、"数据分析"等）和对话历史突然出现，没有渐入过渡，视觉非常突兀。

### 根因

`Sidebar.tsx` 中用 `{!collapsed && <span>...文字</span>}` 条件渲染。展开时 React 直接挂载 DOM，文字瞬间出现。CSS 的 `transition-all` 只处理宽度过渡，不处理子元素的显隐。

### 修复方案

**方案 A（推荐）：CSS 延迟渐入**

给展开时才显示的文字元素加上 CSS transition，让它们在宽度过渡完成后才渐入：

```css
/* index.css 中新增 */
.sidebar-text-enter {
  opacity: 0;
  transition: opacity 0.15s ease-out 0.1s;  /* 延迟 0.1s 等宽度展开 */
}

.sidebar-text-enter.visible {
  opacity: 1;
}
```

Sidebar.tsx 中修改：

```tsx
{/* 导航文字 */}
{!collapsed && (
  <span className="text-sm sidebar-text-enter visible">{item.label}</span>
)}
```

**方案 B：用 CSS 控制显隐而非 React 条件渲染**

把所有内容始终渲染，用 CSS `opacity` + `pointer-events` + `width: 0; overflow: hidden` 控制：

```tsx
{/* 导航文字 - 始终渲染，用 CSS 控制显隐 */}
<span
  className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${
    collapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100 delay-100'
  }`}
>
  {item.label}
</span>
```

**方案 B 更好**：因为 React 条件渲染会导致 DOM 卸载/挂载，而 CSS 控制只是视觉显隐，过渡更平滑。

### Sidebar.tsx 完整改法

将所有 `{!collapsed && (...)}` 改为 CSS 控制：

```tsx
{/* Logo 文字 */}
<span
  className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${
    collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-150'
  }`}
>
  知更 Knower
</span>

{/* 导航文字 */}
{navItems.map((item) => (
  <button key={item.id} ...>
    <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
    <span
      className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${
        collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-100'
      }`}
    >
      {item.label}
    </span>
  </button>
))}

{/* 搜索框 - 始终渲染 */}
<div
  className={`overflow-hidden transition-all duration-200 ${
    collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-100'
  }`}
>
  <div className="relative">
    <input ... />
  </div>
</div>

{/* "最近对话" 标题 */}
<span
  className={`text-[11px] uppercase tracking-wider text-mute whitespace-nowrap overflow-hidden transition-all duration-200 ${
    collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-100'
  }`}
>
  最近对话
</span>

{/* 对话列表项 */}
{conversations.map((conv) => (
  <button key={conv.id} ...>
    <span className="material-symbols-outlined text-[14px] text-mute shrink-0">chat_bubble</span>
    <span
      className={`text-xs text-on-surface truncate transition-all duration-200 ${
        collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-100'
      }`}
    >
      {conv.title}
    </span>
  </button>
))}
```

### 改动文件

- `src/components/Sidebar.tsx`：将条件渲染改为 CSS 控制
- `src/index.css`：无需改动（transition 已在 Tailwind 中）

---

## 问题 2：搜索框 focus 时绿色边框太突兀

### 现象

搜索框获得焦点时，有一个亮绿色（`primary` 色）的粗边框，在暗色背景上非常刺眼。

### 修复方案

将 focus 态改为低调的细边框：

```tsx
{/* 旧 */}
className="w-full bg-surface-container rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-on-surface placeholder:text-mute outline-none focus:ring-1 focus:ring-primary/50"

{/* 新 */}
className="w-full bg-surface-container rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-on-surface placeholder:text-mute outline-none border border-transparent focus:border-outline-variant/50 transition-colors"
```

去掉 `focus:ring-primary/50`，改为 `focus:border-outline-variant/50`。绿色边框只保留给当前激活的导航项。

### 改动文件

- `src/components/Sidebar.tsx`：搜索框 className

---

## 问题 3：暗夜模式切换

### 目标

在侧边栏底部增加主题切换按钮，支持三种模式：
- ☀️ 浅色模式（白色背景）
- 🌙 深色模式（当前暗绿色背景）
- 💻 跟随系统

### 设计

```
┌──────────────────────────┐
│                          │
│  ... 对话列表 ...         │
│                          │
├──────────────────────────┤
│  ☀️  🌙  💻     < 折叠   │  ← 底部主题切换 + 折叠按钮
└──────────────────────────┘
```

三个圆形按钮，当前选中的高亮。hover 时 tooltip 显示模式名称。

### 改动文件

1. `src/components/Sidebar.tsx`（新增主题切换 UI）
2. `src/index.css`（主题色变量）
3. `tailwind.config.js`（支持 light 主题色）
4. `electron/main.ts`（持久化主题设置）
5. `electron/preload.ts`（新增 API）

### 具体实现

**a) 主题色变量体系**

在 `index.css` 中，将所有颜色改为 CSS 变量，支持主题切换：

```css
/* 深色主题（默认） */
:root, .theme-dark {
  --bg: #0e150f;
  --surface: #141414;
  --surface-low: #161d17;
  --surface-container: #1a211b;
  --surface-high: #242c25;
  --on-surface: #dde5da;
  --on-surface-variant: #bccabb;
  --outline-variant: #3d4a3e;
  --primary: #6bfb9a;
  --mute: #525252;
}

/* 浅色主题 */
.theme-light {
  --bg: #f8f9fa;
  --surface: #ffffff;
  --surface-low: #f1f3f5;
  --surface-container: #e9ecef;
  --surface-high: #dee2e6;
  --on-surface: #212529;
  --on-surface-variant: #495057;
  --outline-variant: #ced4da;
  --primary: #0d9e4f;
  --mute: #868e96;
}
```

**b) 主题切换组件**

在 Sidebar.tsx 底部新增：

```tsx
const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark')

const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
  setTheme(newTheme)
  // 应用主题
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-light')

  if (newTheme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
  } else {
    root.classList.add(`theme-${newTheme}`)
  }

  // 持久化
  window.electronAPI?.setStore('theme', newTheme)
}

// 初始化时读取
useEffect(() => {
  window.electronAPI?.getStore('theme').then((saved) => {
    if (saved) handleThemeChange(saved as 'dark' | 'light' | 'system')
  })
}, [])
```

底部渲染：

```tsx
<div className="px-2 py-3 border-t border-border/30 space-y-3">
  {/* 主题切换 */}
  {!collapsed && (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => handleThemeChange('light')}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          theme === 'light' ? 'bg-primary/20 text-primary' : 'text-mute hover:text-on-surface hover:bg-surface-container'
        }`}
        title="浅色模式"
      >
        <span className="material-symbols-outlined text-[16px]">light_mode</span>
      </button>
      <button
        onClick={() => handleThemeChange('dark')}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          theme === 'dark' ? 'bg-primary/20 text-primary' : 'text-mute hover:text-on-surface hover:bg-surface-container'
        }`}
        title="深色模式"
      >
        <span className="material-symbols-outlined text-[16px]">dark_mode</span>
      </button>
      <button
        onClick={() => handleThemeChange('system')}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          theme === 'system' ? 'bg-primary/20 text-primary' : 'text-mute hover:text-on-surface hover:bg-surface-container'
        }`}
        title="跟随系统"
      >
        <span className="material-symbols-outlined text-[16px]">computer</span>
      </button>
    </div>
  )}

  {/* 折叠按钮 */}
  <button onClick={() => setCollapsed(!collapsed)} ...>
    <span className={`material-symbols-outlined text-[18px] transition-transform ${collapsed ? 'rotate-180' : ''}`}>
      chevron_left
    </span>
  </button>
</div>
```

折叠态只显示图标：

```tsx
{collapsed && (
  <div className="flex flex-col items-center gap-1 mb-2">
    <button onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 rounded-full flex items-center justify-center text-mute hover:text-on-surface hover:bg-surface-container"
      title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
    >
      <span className="material-symbols-outlined text-[16px]">
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  </div>
)}
```

**c) Tailwind 配置改造**

将 `tailwind.config.js` 中的硬编码颜色改为引用 CSS 变量：

```javascript
colors: {
  primary: 'var(--primary)',
  'on-primary': '#003919',
  background: 'var(--bg)',
  surface: 'var(--surface)',
  'surface-low': 'var(--surface-low)',
  'surface-container': 'var(--surface-container)',
  'surface-high': 'var(--surface-high)',
  'surface-highest': '#2f372f',
  'on-surface': 'var(--on-surface)',
  'on-surface-variant': 'var(--on-surface-variant)',
  outline: '#869486',
  'outline-variant': 'var(--outline-variant)',
  sidebar: 'var(--bg)',
  border: '#222222',
  body: '#a3a3a3',
  ink: '#f0f0f0',
  mute: 'var(--mute)',
},
```

**d) body 背景色**

`index.css` 中 body 背景改为：

```css
body {
  background: var(--bg);
  color: var(--on-surface);
}
```

**e) 主题持久化**

`electron/main.ts` 已有 `get-store` / `set-store`，主题值存在 `settings.json` 的 `theme` 字段。

`electron/preload.ts` 已有 `getStore` / `setStore`，无需新增。

### 浅色主题配色参考

| 变量 | 浅色值 | 说明 |
|---|---|---|
| `--bg` | `#f8f9fa` | 页面背景 |
| `--surface` | `#ffffff` | 卡片背景 |
| `--surface-low` | `#f1f3f5` | 侧边栏/输入框背景 |
| `--surface-container` | `#e9ecef` | 悬浮/选中背景 |
| `--surface-high` | `#dee2e6` | hover 背景 |
| `--on-surface` | `#212529` | 主文字 |
| `--on-surface-variant` | `#495057` | 次要文字 |
| `--outline-variant` | `#ced4da` | 边框 |
| `--primary` | `#0d9e4f` | 主色调（绿色，深色主题下太亮需调暗） |
| `--mute` | `#868e96` | 弱化文字 |

### 验收标准

- [ ] 侧边栏展开时文字有 100-150ms 的渐入动画，不突兀
- [ ] 搜索框 focus 时边框变为低调灰色，不再亮绿色
- [ ] 侧边栏底部显示三个主题按钮：☀️ 浅色 / 🌙 深色 / 💻 系统
- [ ] 点击按钮立即切换主题，所有页面颜色同步变化
- [ ] 主题设置重启后保持
- [ ] 浅色模式下所有文字可读、对比度足够
- [ ] 折叠态侧边栏底部显示一个主题切换快捷按钮

---

## 执行顺序

1. 侧边栏动画修复（条件渲染 → CSS 控制）— 30 分钟
2. 搜索框 focus 样式修复 — 5 分钟
3. 主题色变量体系搭建（index.css + tailwind.config.js）— 1 小时
4. 主题切换组件（Sidebar.tsx）— 30 分钟
5. 浅色主题配色调试 — 1 小时

总计约 3 小时。

---

*知更 Knower · 侧边栏动画 + 主题切换提示词*
