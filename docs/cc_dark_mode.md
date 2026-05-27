# 给 CC 的提示词：暗色模式配色重设计（Cursor 风格）

## 问题

当前暗色模式是简单把浅色背景反成黑色，所有元素混在一起没有层次。需要重新设计一套暗色配色，保持 Cursor 风格的温暖质感。

## 设计原则

Cursor 是暖色调设计。暗色模式也要**温暖**，不用纯黑/纯灰，用带暖色调的深色。

---

## 暗色配色方案

### CSS 变量（在 `index.css` 中 `.theme-dark` 下）

```css
.theme-dark {
  /* 画布 — 暖深色，不是纯黑 */
  --canvas: #1c1b18;
  --canvas-soft: #232220;

  /* 表面 — 比画布略亮，卡片用 */
  --surface: #2a2926;
  --surface-strong: #3a3835;

  /* 发丝线 — 暗色模式下用更亮的线 */
  --hairline: #3a3835;
  --hairline-soft: #2f2e2b;
  --hairline-strong: #4a4845;

  /* 文字 — 暖色调，不用纯白 */
  --ink: #e8e5dd;              /* 暖米白，标题 */
  --body: #b0ada5;             /* 暖灰，正文 */
  --body-strong: #e8e5dd;
  --muted: #7a776f;            /* 弱化文字 */
  --muted-soft: #5a5852;       /* 更弱 */

  /* 强调色 — 保持橙色，亮度微调 */
  --primary: #ff6a2a;          /* 比浅色模式稍亮，在深底上更醒目 */
  --primary-active: #e05520;
  --on-primary: #ffffff;

  /* AI 时间线 — 暗色下饱和度略降 */
  --timeline-thinking: #c48a6f;
  --timeline-grep: #7aab7e;
  --timeline-read: #7a9ec4;
  --timeline-edit: #a088c0;
  --timeline-done: #c08532;

  /* 语义色 */
  --semantic-success: #3dba90;
  --semantic-error: #e05570;
}
```

### 对应 Tailwind 配色

```javascript
// tailwind.config.js 中新增 dark: 前缀，或用 CSS 变量
colors: {
  // 通过 CSS 变量引用，浅色/暗色自动切换
  canvas: 'var(--canvas)',
  'canvas-soft': 'var(--canvas-soft)',
  surface: 'var(--surface)',
  'surface-strong': 'var(--surface-strong)',
  hairline: 'var(--hairline)',
  'hairline-soft': 'var(--hairline-soft)',
  'hairline-strong': 'var(--hairline-strong)',
  ink: 'var(--ink)',
  body: 'var(--body)',
  muted: 'var(--muted)',
  'muted-soft': 'var(--muted-soft)',
  primary: 'var(--primary)',
  'primary-active': 'var(--primary-active)',
  'on-primary': 'var(--on-primary)',
}
```

---

## 浅色 vs 暗色对比

| Token | 浅色模式 | 暗色模式 | 关系 |
|---|---|---|---|
| canvas | #f7f7f4（暖奶油） | #1c1b18（暖深棕） | 暗色不用纯黑，带暖色调 |
| surface | #ffffff（纯白） | #2a2926（暖深灰） | 比 canvas 亮一档 |
| surface-strong | #e6e5e0 | #3a3835 | 标签/徽章背景 |
| hairline | #e6e5e0 | #3a3835 | 暗色下和 surface-strong 同色 |
| ink | #26251e（暖近黑） | #e8e5dd（暖米白） | 暗色不用纯白 #fff |
| body | #5a5852 | #b0ada5 | 暖灰 |
| muted | #807d72 | #7a776f | 保持相近 |
| primary | #f54e00 | #ff6a2a | 暗色下亮度 +10%，更醒目 |
| on-primary | #ffffff | #ffffff | 不变 |

---

## 关键差异（vs 简单反色）

### 1. 不用纯黑

```css
/* ❌ 错误：简单反色 */
.theme-dark { background: #000000; }

/* ✅ 正确：暖深色 */
.theme-dark { background: #1c1b18; }
```

### 2. 不用纯白文字

```css
/* ❌ 错误：纯白文字刺眼 */
.theme-dark { color: #ffffff; }

/* ✅ 正确：暖米白 */
.theme-dark { color: #e8e5dd; }
```

### 3. 卡片要有层次

```css
/* ❌ 错误：卡片和背景同色 */
.theme-dark .card { background: #1c1b18; }

/* ✅ 正确：卡片比背景亮 */
.theme-dark .card {
  background: #2a2926;     /* 比 canvas #1c1b18 亮 */
  border-color: #3a3835;   /* 发丝线可见 */
}
```

### 4. 橙色强调要更亮

```css
/* ❌ 错误：浅色模式的橙色在深底上太暗 */
.theme-dark { --primary: #f54e00; }

/* ✅ 正确：暗色下提亮 */
.theme-dark { --primary: #ff6a2a; }
```

---

## 实现方式

### 在 index.css 中用 class 切换

```css
:root {
  /* 默认浅色 */
  --canvas: #f7f7f4;
  --surface: #ffffff;
  --hairline: #e6e5e0;
  --ink: #26251e;
  --body: #5a5852;
  --muted: #807d72;
  --primary: #f54e00;
  /* ... */
}

.theme-dark {
  --canvas: #1c1b18;
  --surface: #2a2926;
  --hairline: #3a3835;
  --ink: #e8e5dd;
  --body: #b0ada5;
  --muted: #7a776f;
  --primary: #ff6a2a;
  /* ... */
}
```

### body 背景跟随

```css
body {
  background: var(--canvas);
  color: var(--ink);
  transition: background 0.3s, color 0.3s;
}
```

### 所有组件用 CSS 变量

```css
.card {
  background: var(--surface);
  border: 1px solid var(--hairline);
}

.btn-primary {
  background: var(--primary);
  color: var(--on-primary);
}
```

**不要在组件中硬编码 hex 值**，全部用 `var(--xxx)` 引用。

### 主题切换逻辑

```typescript
// Sidebar.tsx 中
const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
  } else {
    root.classList.add(`theme-${theme}`)
  }

  window.electronAPI?.setStore('theme', theme)
}
```

### 监听系统主题变化

```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    const saved = localStorage.getItem('theme') || 'system'
    if (saved === 'system') applyTheme('system')
  }
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}, [])
```

---

## 验收标准

- [ ] 暗色模式背景为暖深色 #1c1b18，不是纯黑
- [ ] 文字为暖米白 #e8e5dd，不是纯白
- [ ] 卡片比背景亮（surface > canvas），有层次感
- [ ] 发丝线在暗色下可见（#3a3835）
- [ ] 橙色 CTA 在深底上醒目（#ff6a2a）
- [ ] 浅色/暗色切换有过渡动画（0.3s）
- [ ] 系统主题变化自动跟随
- [ ] 所有组件用 CSS 变量，无硬编码 hex

---

*知更 Knower · 暗色模式配色提示词*
