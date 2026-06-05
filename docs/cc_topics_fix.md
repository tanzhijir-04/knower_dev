# 给 CC 的提示词：灵感库选题修复

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 问题

灵感库点"生成选题"后，一直提示"Agent 未返回选题"。

## 根因

`src/components/TopicsView.tsx` 的 agent event listener 中，`done` 事件在 `tool_result` 之后到达，但 `thinkingCompleteRef.current` 还没更新（React state 异步），导致 `done` 事件误判为没拿到选题。另外如果 LLM 返回格式异常（topics 为空数组），也不会设 `thinkingComplete`。

## 修复

**文件**：`src/components/TopicsView.tsx`

替换 agent event listener（从 `const unsub = api.onTopicAgentEvent` 开始到 `return unsub` 结束的整个回调），改为：

```tsx
const unsub = api.onTopicAgentEvent((raw) => {
  try {
    const evt: AgentEvent = JSON.parse(raw)
    setAgentEvents(prev => [...prev, evt])

    // 1. 从 tool_result 提取选题
    if (evt.type === 'tool_result' && evt.name === 'suggest_topics') {
      const result = typeof evt.result === 'string' ? JSON.parse(evt.result) : evt.result
      if (result?.topics?.length) {
        setTopics(result.topics)
        setThinkingComplete(true)
        api.saveTopicHistory(platform, 'agent', result.topics).catch(() => {})
        loadHistory()
        setTimeout(() => setViewState('results'), 300)
        return
      }
      if (!result?.error) {
        setThinkingComplete(true)
      }
    }

    // 2. 从 text 事件兜底提取 JSON 选题
    if (evt.type === 'text' && evt.text) {
      try {
        const match = evt.text.match(/\[[\s\S]*\]/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
            setTopics(parsed)
            setThinkingComplete(true)
            api.saveTopicHistory(platform, 'agent', parsed).catch(() => {})
            loadHistory()
            setTimeout(() => setViewState('results'), 300)
            return
          }
        }
      } catch {}
    }

    if (evt.type === 'error') {
      setError(evt.message || 'Agent 执行失败')
      showToast(`生成失败: ${evt.message}`, 'error')
      setViewState('initial')
      return
    }

    if (evt.type === 'done') {
      if (topics.length > 0 || thinkingCompleteRef.current) {
        setViewState('results')
      } else {
        setError('Agent 未返回选题，请重试')
        setViewState('initial')
      }
    }
  } catch { /* ignore parse errors */ }
})
```

useEffect 依赖数组改为 `[api, loadHistory, showToast, platform, topics.length]`。

---

## 验证

1. 灵感库选平台 → 选模式 → 点生成 → 等待 → 显示选题列表
2. 如果 LLM 走工具调用：tool_result 事件正确提取 topics
3. 如果 LLM 在文本中输出 JSON：text 事件兜底提取
4. done 事件不再误报"未返回选题"