# 给 CC 的修复提示词：Agent 智能判断 + 切 Tab 输出不丢失

## 背景

知更 Knower 有两个体验问题需要修复。

---

## 问题 1：Agent 把所有输入都当脚本处理

### 现象

用户发送"你是谁"，Agent 走了完整的脚本分析流程（analyze_script → expand_script → save_result），输出"你的脚本「你是谁」很适合做成一个AI身份揭秘的短视频"。实际上用户只是在问一个普通问题。

### 根因

`knower-agent/agent/core.js` 第 5-103 行的 `BASE_SYSTEM_PROMPT` 硬编码了：

```
## 工作流程
收到用户脚本后，严格按以下步骤执行：
### 第一步：分析脚本
### 第二步：生成各平台物料
### 第三步：保存结果

## 重要规则
- 必须严格按步骤调用工具：先 analyze_script，再 expand_script，最后 save_result
```

不管用户发什么，Agent 都按脚本流程处理。

### 修复方案

重写 `BASE_SYSTEM_PROMPT`，增加意图识别逻辑。将"必须严格按步骤"改为条件判断：

```javascript
const BASE_SYSTEM_PROMPT = `你是知更 AI，一个专门服务中文视频创作者的智能助手。

## 核心能力

你有两种工作模式，根据用户输入的内容自动判断：

### 模式一：脚本创作（当用户输入的内容是视频脚本/文案/拍摄稿时）

判断标准：输入内容较长（通常 >100 字），包含具体的视频内容描述、产品介绍、观点阐述等。

执行流程：
1. 分析脚本内容，调用 analyze_script 工具
2. 基于分析结果，调用 expand_script 工具生成各平台物料
3. 调用 save_result 工具保存到数据库并提炼记忆
4. 输出自然语言总结（2-4 句话，口语化有温度）

### 模式二：自由对话（当用户输入的是普通问题、闲聊、询问等）

判断标准：输入较短，是提问、打招呼、讨论想法等非脚本内容。

执行流程：
- 直接用自然语言回答，不需要调用任何工具
- 如果用户在讨论创作方向/选题想法，可以给出建议但不强制生成物料
- 如果用户主动要求生成物料，再切换到模式一

## 重要规则

- 先判断用户意图，再决定走哪个模式
- 不要把普通问题当脚本分析
- 只有确认是脚本内容时才调用工具
- 自由对话时保持自然、有温度，像一个懂创作的朋友`
```

### 改动文件

- `knower-agent/agent/core.js`：替换 `BASE_SYSTEM_PROMPT`（第 5-103 行）

### 验收标准

- [ ] 发送"你是谁"→ Agent 正常自我介绍，不走脚本流程
- [ ] 发送一段完整的视频脚本 → Agent 走脚本分析流程
- [ ] 发送"帮我想想科技类选题" → Agent 给建议，不强制生成物料
- [ ] 发送"帮我生成 B站物料" + 脚本内容 → Agent 走脚本流程

---

## 问题 2：切 Tab 时流式输出中断且丢失

### 现象

用户在创作台发送消息，Agent 正在流式输出，此时切换到"数据分析"Tab，再切回"创作台"，刚才的输出消失了。

### 根因

`src/App.tsx` 用 `renderPage()` switch 渲染页面：

```tsx
const renderPage = () => {
  switch (currentPage) {
    case 'chat': return <ChatView ... />
    case 'data': return <DataView ... />
    // ...
  }
}
```

只有当前页面会被 React 挂载。切换到数据分析时 ChatView 卸载，`messages` state（React useState）清空，`onAgentEvent` 的 `useEffect` cleanup 移除了 IPC 监听器，流式输出中断且不可恢复。

### 修复方案

**方案：所有页面始终挂载，用 CSS `display` 控制可见性。**

改动 `src/App.tsx`，将 `renderPage()` 改为始终渲染所有页面，通过 `hidden` 属性隐藏非当前页面：

```tsx
return (
  <div className="flex h-screen bg-background">
    <ToastProvider>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        conversationVersion={conversationVersion}
        onOpenConversation={(id) => {
          setOpenConversationId(id)
          setCurrentPage('chat')
        }}
      />
      <main className="flex-1 flex flex-col overflow-hidden pt-[48px]">
        {/* 所有页面始终挂载，用 hidden 控制显示 */}
        <div style={{ display: currentPage === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ChatView
            initialConversationId={openConversationId}
            onConversationOpened={() => setOpenConversationId(null)}
            onNavigate={setCurrentPage}
            onConversationChange={() => setConversationVersion(v => v + 1)}
          />
        </div>
        <div style={{ display: currentPage === 'data' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <DataView
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            conversationVersion={conversationVersion}
          />
        </div>
        <div style={{ display: currentPage === 'topics' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <TopicsView />
        </div>
        <div style={{ display: currentPage === 'settings' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <SettingsView />
        </div>
      </main>
    </ToastProvider>
  </div>
)
```

**注意**：
1. `ChatView` 和 `DataView` 需要传 `currentPage` prop，用来判断自己是否可见。当 `currentPage === 'chat'` 时 ChatView 才加载对话历史等数据（避免不可见时做无用操作）
2. 非当前页面用 `display: none` 隐藏，React 不会卸载组件，state 保留
3. `onAgentEvent` 的 `useEffect` 不会被 cleanup，流式输出继续
4. `DataView` 也用 `display: none`，避免不可见时发起网络请求

### 改动文件

- `src/App.tsx`：将条件渲染改为 display 控制

### 验收标准

- [ ] 在创作台发送消息，Agent 输出过程中切换到数据分析，再切回创作台，输出仍在继续
- [ ] 切换 Tab 后，原来的对话内容完整保留
- [ ] 流式输出的光标动画不受影响
- [ ] 各页面功能正常，不受始终挂载的影响

---

## 执行顺序

1. 先修问题 2（App.tsx 改 display 控制）— 改动小，风险低
2. 再修问题 1（系统提示词重写）— 改动大，需要测试多种输入场景

两个问题独立，可以并行修。
