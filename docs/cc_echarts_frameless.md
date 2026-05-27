# 给 CC 的提示词：无边框窗口 + 粉丝数修复

---


## 问题 4：无边框窗口（隐藏标题栏）

### 目标

隐藏原生 Electron 标题栏（File/Edit/View/Window/Help + 窗口图标），让应用内容填满整个窗口。像 Codex 客户端一样。

### 改动文件

1. `electron/main.ts` — BrowserWindow 配置
2. `src/components/Sidebar.tsx` — 顶部增加自定义标题栏区域
3. `src/index.css` — macOS 拖拽区域样式

### main.ts 改动

```typescript
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600,
  frame: false,                    // ← 关键：无边框窗口
  titleBarStyle: 'hidden',         // ← macOS 隐藏标题栏但保留红绿灯
  trafficLightPosition: { x: 12, y: 12 },  // macOS 红绿灯位置
  backgroundColor: '#f7f7f4',      // 改为奶油底
  icon,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

### 自定义窗口控制按钮

在 Sidebar 顶部或 App 顶部增加窗口控制：

```tsx
// Sidebar.tsx 顶部
<div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
  <div className="flex items-center gap-3">
    <img src={logoSvg} className="w-7 h-7 rounded-lg" />
    {!collapsed && <span className="text-sm font-medium text-ink">知更 Knower</span>}
  </div>

  {/* 窗口控制按钮（非 macOS） */}
  {process.platform !== 'darwin' && (
    <div className="flex items-center gap-1">
      <button onClick={() => window.electronAPI?.minimizeWindow()}
        className="w-6 h-6 rounded flex items-center justify-center text-muted hover:bg-surface-strong hover:text-ink transition-colors">
        <span className="material-symbols-outlined text-[14px]">remove</span>
      </button>
      <button onClick={() => window.electronAPI?.maximizeWindow()}
        className="w-6 h-6 rounded flex items-center justify-center text-muted hover:bg-surface-strong hover:text-ink transition-colors">
        <span className="material-symbols-outlined text-[14px]">crop_square</span>
      </button>
      <button onClick={() => window.electronAPI?.closeWindow()}
        className="w-6 h-6 rounded flex items-center justify-center text-muted hover:bg-red-500 hover:text-white transition-colors">
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  )}
</div>
```

### preload.ts 新增窗口控制 API

```typescript
minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
closeWindow: () => ipcRenderer.invoke('window-close'),
```

### main.ts 新增 IPC

```typescript
ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close', () => mainWindow?.close())
```

### electron.d.ts 类型声明

```typescript
minimizeWindow: () => Promise<void>
maximizeWindow: () => Promise<void>
closeWindow: () => Promise<void>
```

### macOS 拖拽区域

侧边栏顶部已经是拖拽区域（`titlebar-drag` class）。确保：

```css
.titlebar-drag {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
```

macOS 上红绿灯按钮自动显示在左上角，不需要自定义。Windows/Linux 上显示自定义的最小化/最大化/关闭按钮。

---

## 问题 5：粉丝数修复

### 现象

概览卡片"粉丝数"显示 0。

### 根因

`analyze-video-data` handler 没有返回 `fans` 字段，或者 `getSourceList` 没有返回 `total_fans`。

### 修复

**a) `db/index.js` 的 `getSourceList`**：

```javascript
const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned, total_fans FROM creators')
```

返回值加 `fans`。

**b) `main.ts` 的 `analyze-video-data` handler**：

在 return 语句中加：

```typescript
const creators = await db.getCreators()
const matchingCreator = creators.find((c: any) => c.uid === sourceUid)
const fans = matchingCreator?.totalFans || 0

return {
  overview: { /* ... */ },
  fans,  // ← 新增
  topByEngagement: /* ... */,
  ...analysis,
}
```

**c) `DataView.tsx` 的 `OverviewCards`**：

```tsx
<OverviewCards overview={analysis.overview} fans={analysis.fans} />
```

---

## 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/lib/chartTheme.ts` | 新建，ECharts 统一主题 |
| `src/components/data/TrendChart.tsx` | 固定高度 + 引用主题 |
| `src/components/data/CategoryChart.tsx` | 修复标签 + 引用主题 |
| `src/components/data/TimeChart.tsx` | 固定高度 + 引用主题 |
| `src/components/data/RadarChart.tsx` | 引用主题 + 暖色 |
| `src/components/data/ScatterChart.tsx` | 引用主题 |
| `electron/main.ts` | frame: false + 窗口控制 IPC |
| `electron/preload.ts` | 暴露窗口控制 API |
| `src/types/electron.d.ts` | 类型声明 |
| `src/components/Sidebar.tsx` | 自定义标题栏 + 窗口按钮 |
| `knower-agent/db/index.js` | getSourceList 返回 total_fans |
| `electron/main.ts` | analyze-video-data 返回 fans |

---

## 验收标准


### 无边框窗口

- [ ] Windows 上无原生标题栏（File/Edit/View 消失）
- [ ] 自定义最小化/最大化/关闭按钮正常工作
- [ ] macOS 上保留红绿灯按钮
- [ ] 侧边栏顶部可拖拽窗口
- [ ] 窗口可正常缩放

### 粉丝数

- [ ] 粉丝数正确显示（非 0）
- [ ] 创作者详情头部显示粉丝数

