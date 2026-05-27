# 给 CC 的提示词：文件导入 + 多平台爬取验证

---

## 一、文件导入（.txt / .md / .docx）

### 目标

用户可以在创作台通过文件选择器或拖拽导入脚本文件，内容自动填入输入框。

### 改动文件

1. `package.json` — 新增 mammoth 依赖
2. `src/components/ChatView.tsx` — 文件导入逻辑 + 拖拽区域

### 安装依赖

```bash
npm install mammoth
```

### 实现

**a) 文件选择器（已有的附件按钮绑定）**

找到 ChatView 中的附件按钮（`attach_file` 图标），绑定 file input：

```tsx
const fileInputRef = useRef<HTMLInputElement>(null)

const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  let text = ''
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'txt' || ext === 'md') {
    text = await file.text()
  } else if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      text = result.value
    } catch (err) {
      showToast('docx 解析失败: ' + (err as Error).message, 'error')
      return
    }
  } else {
    showToast('不支持的文件格式，请使用 .txt / .md / .docx', 'error')
    return
  }

  if (text.trim()) {
    setInput(prev => prev ? prev + '\n\n' + text.trim() : text.trim())
    showToast(`已导入 ${file.name}（${text.length} 字）`, 'success')
    textareaRef.current?.focus()
  } else {
    showToast('文件内容为空', 'error')
  }

  // 清空 input 以支持重复选择同一文件
  e.target.value = ''
}

// JSX
<input
  ref={fileInputRef}
  type="file"
  accept=".txt,.md,.docx"
  onChange={handleFileImport}
  className="hidden"
/>
<button
  onClick={() => fileInputRef.current?.click()}
  className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0 mb-0.5"
  title="导入文件（.txt/.md/.docx）"
>
  <span className="material-symbols-outlined text-[20px]">attach_file</span>
</button>
```

**b) 拖拽导入（增强体验）**

在 ChatView 的消息区域增加拖拽检测：

```tsx
const [isDragging, setIsDragging] = useState(false)

// 拖拽事件
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault()
  setIsDragging(true)
}
const handleDragLeave = () => setIsDragging(false)
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault()
  setIsDragging(false)
  const file = e.dataTransfer.files[0]
  if (file) {
    // 复用文件导入逻辑
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (['txt', 'md', 'docx'].includes(ext || '')) {
      let text = ''
      if (ext === 'docx') {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        text = result.value
      } else {
        text = await file.text()
      }
      setInput(prev => prev ? prev + '\n\n' + text.trim() : text.trim())
      showToast(`已导入 ${file.name}`, 'success')
    }
  }
}

// 在消息区域 div 上绑定
<div
  className="flex-1 overflow-y-auto relative"
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {/* 拖拽遮罩 */}
  {isDragging && (
    <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/30 rounded-xl z-20 flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-primary mb-2">upload_file</span>
        <p className="text-sm text-on-surface">拖放文件到这里导入</p>
        <p className="text-[11px] text-mute">支持 .txt / .md / .docx</p>
      </div>
    </div>
  )}
  {/* ... 现有消息内容 ... */}
</div>
```

### 验收标准

- [ ] 点击附件按钮弹出文件选择器，支持 .txt/.md/.docx
- [ ] 选择文件后内容填入输入框，显示 toast 提示
- [ ] 拖拽文件到对话区域可导入
- [ ] docx 文件通过 mammoth 解析，不需要安装 Word
- [ ] 空文件或不支持格式有错误提示

---

## 二、多平台爬取验证

### 目标

验证抖音、小红书、微博的爬取功能是否正常工作，修复发现的问题。

### 验证步骤

**手动测试清单**：

| 平台 | 测试类型 | 输入 | 预期结果 |
|---|---|---|---|
| B站 | 关键词搜索 | `科技测评` | 返回 15 条视频数据 |
| B站 | 创作者主页 | UID `440609243` | 返回该UP主的视频列表 + 创作者信息 |
| 抖音 | 关键词搜索 | `美食` | 返回视频数据（可能需要扫码登录） |
| 小红书 | 关键词搜索 | `穿搭` | 返回笔记数据 |
| 小红书 | 创作者主页 | 某个小红书用户 ID | 返回创作者数据 |
| 微博 | 关键词搜索 | `科技` | 返回微博数据 |

### 已知可能的问题

1. **抖音需要 JS 签名**：`AGENTS.md` 提到"抖音需要 Node.js（JS 签名）"，可能需要额外配置
2. **扫码登录**：首次运行各平台需要扫码登录，登录状态保存在 `mediasrc/login_state/`
3. **Playwright 浏览器**：MediaCrawler 依赖 Playwright，需要确保浏览器已安装（`playwright install`）
4. **反爬检测**：部分平台可能触发验证码

### 自动化验证脚本

在 `knower-agent/crawler/` 下新增 `test_crawler.js`：

```javascript
// test_crawler.js — 验证各平台爬取功能
const { runCrawler } = require('../lib/crawler')

const TESTS = [
  { platform: 'bili', keyword: '科技', expected: 'videos' },
  { platform: 'xhs', keyword: '穿搭', expected: 'notes' },
  { platform: 'dy', keyword: '美食', expected: 'videos' },
  { platform: 'wb', keyword: '科技', expected: 'posts' },
]

async function runTests() {
  for (const test of TESTS) {
    console.log(`\n--- 测试 ${test.platform} 关键词搜索 ---`)
    try {
      const result = await runCrawler(test.platform, test.keyword, { maxNotes: 3 })
      console.log(`✅ ${test.platform}: 获取到 ${result.contents?.length || 0} 条数据`)
      if (result.creators?.length) {
        console.log(`   创作者: ${result.creators[0].nickname}`)
      }
      if (result.contents?.length) {
        console.log(`   第一条: ${result.contents[0].title}`)
      }
    } catch (err) {
      console.log(`❌ ${test.platform}: ${err.message}`)
    }
  }
}

runTests()
```

### 运行方式

```bash
cd knower-agent
node crawler/test_crawler.js
```

### 修复流程

1. 运行测试脚本，记录哪些平台失败
2. 检查 `run_crawler.py` 的 stderr 输出，定位具体错误
3. 常见修复：
   - 登录过期 → 重新扫码
   - Playwright 浏览器缺失 → `npx playwright install chromium`
   - 签名问题 → 检查 `mediasrc/` 中的签名模块
4. 修复后重新运行测试

### 验收标准

- [ ] B站关键词搜索正常
- [ ] B站创作者主页正常（含头像、昵称、粉丝数）
- [ ] 小红书关键词搜索正常
- [ ] 抖音关键词搜索正常（或明确记录需要的额外配置）
- [ ] 微博关键词搜索正常（或明确记录限制）
- [ ] 爬取数据正确存入 SQLite（source_uid 和 source_name 正确）
- [ ] 测试脚本可重复运行

---

*知更 Knower · 文件导入 + 多平台爬取验证提示词*
