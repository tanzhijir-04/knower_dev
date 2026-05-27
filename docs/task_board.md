# 知更 Knower · 全局任务清单 v2

**更新时间** 2025-05-25  
**变更** 移除字幕稿功能；P0 新增数据分析大改 + 文件导出 + 文件导入 + 多平台爬取验证

---

## 已产出提示词/方案

| 文档 | 覆盖内容 |
|---|---|
| `knower_prd_v2.md` | 产品 PRD |
| `knower_ui_prd.md` | UI 设计规范 |
| `improvement_plan.md` | 全量改进计划 P0-P8 |
| `cc_agent_overhaul.md` | Agent 智能化改造 |
| `cc_agent_smart.md` | Agent 意图检测 + 表单交互 |
| `cc_chat_redesign.md` | 创作台交互重设计（含 F1-F5 功能） |
| `cc_sidebar_actions.md` | 侧边栏对话历史增强 |
| `cc_sidebar_theme.md` | 侧边栏动画 + 主题切换 |
| `cc_fix_agent.md` | Agent 智能判断 + 切Tab |
| `cc_prompt.md` | 通用开发入口 |

---

## P0：必须先做（体验基础）

| # | 模块 | 状态 | 说明 |
|---|---|---|---|
| 1 | 字体渲染修复 | ✅ 已有方案 | `improvement_plan.md` P0 |
| 2 | 侧边栏重构 | ✅ 已有方案 | `improvement_plan.md` P1 + `cc_sidebar_actions.md` + `cc_sidebar_theme.md` |
| 3 | Bug 修复（UID/头像/分析持久化） | ✅ 已有方案 | `improvement_plan.md` P2-P3 |
| 4 | Agent 智能化改造 | ✅ 已有方案 | `cc_agent_overhaul.md` + `cc_agent_smart.md` |
| 5 | Agent 判断 + 切Tab不丢失 | ✅ 已有方案 | `cc_fix_agent.md` |
| 6 | **数据分析页大改** | ⏳ 待写 | 专业图表 + 多维度 + 粉丝数 + 下钻 + 导出 + 维度选择 |
| 7 | **数据多格式导出** | ⏳ 待写 | CSV / Markdown / TXT，分析结果和原始数据都能导 |
| 8 | **文件导入** | ⏳ 待写 | .txt / .md / .docx 导入脚本到创作台 |
| 9 | **多平台爬取验证** | ⏳ 待写 | 抖音/小红书/微博爬取功能验证 + Bug 修复 |
| 10 | 创作台输入框 + 操作栏 + Canvas | ✅ 已有方案 | `cc_chat_redesign.md` |

---

## P1：核心功能完善

| # | 模块 | 状态 | 说明 |
|---|---|---|---|
| 11 | 灵感库（TopicsView）完整开发 | ⏳ 待写 | 趋势数据 + 选题卡片 + 发到创作台 |
| 12 | 设置页优化 | ⏳ 待写 | 分组卡片 + 账号管理 + API 连通性测试 |
| 13 | 数据互通（Agent 注入数据摘要） | ✅ 已有方案 | `improvement_plan.md` P7 |

---

## P2：体验打磨

| # | 模块 | 状态 |
|---|---|---|
| 14 | 全局搜索（Cmd+K） | ⏳ 待写 |
| 15 | 快捷键系统 | ⏳ 待写 |
| 16 | 错误处理与重试 | ⏳ 待写 |
| 17 | 首次使用引导 | ⏳ 待写 |

---

## P3：工程化

| # | 模块 | 状态 |
|---|---|---|
| 18 | 自动更新 | ⏳ 待写 |
| 19 | 打包优化 | ⏳ 待写 |
| 20 | 日志系统 | ⏳ 待写 |

---

*知更 Knower · 任务清单 v2*
