# 给 CC 的提示词：后端修复 v3（1 个问题）

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 问题：schedule-create 未注入 accountId

**文件**：`electron/main.ts`

**现状**：`schedule-create` handler 直接把前端传来的 `data` 透传给 `createScheduleItem(data)`，没有注入当前激活账号的 `accountId`。`createScheduleItem` 里 `accountId` 默认 `'default'`，导致所有排期都写到 default 账号，切换创作者后排期不隔离。

对比 `review-create` 已经正确处理了：先 `getActiveAccount()`，再传 `active?.id || 'default'`。

**修复**：替换 `schedule-create` handler：

```typescript
ipcMain.handle('schedule-create', async (_event, data: Record<string, unknown>) => {
  const active = await db.getActiveAccount()
  await db.createScheduleItem({ ...data, accountId: active?.id || 'default' })
  return { ok: true }
})
```