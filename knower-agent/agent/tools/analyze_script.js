module.exports = {
  name: 'analyze_script',
  description: `分析脚本结构，将分析结果作为工具参数传递。这是"脚本->物料"流程的第一步。

**什么时候必须调用：**
- 用户给了脚本内容，说"分析一下"、"帮我看看"
- 用户要生成物料但还没分析过脚本

**什么时候不要调用：**
- 用户已经分析过了，只是要修改物料
- 用户给了脚本但只是想闲聊

**常见错误：**
- 跳过这一步直接调用 expand_script -> 不行，必须先分析再生成
- 分析结果不完整（缺少 keyPoints）-> 必须填写完整`,
  input_schema: {
    type: 'object',
    properties: {
      analysis: {
        type: 'object',
        description: '脚本分析结果',
        properties: {
          videoType: { type: 'string', description: '视频类型（如：科技测评/vlog/教程/开箱）' },
          topic: { type: 'string', description: '核心主题（一句话概括）' },
          audience: { type: 'string', description: '目标受众描述' },
          duration: { type: 'string', description: '预估视频时长' },
          keyPoints: { type: 'array', items: { type: 'string' }, description: '核心卖点列表' },
        },
        required: ['videoType', 'topic', 'audience', 'duration', 'keyPoints'],
      },
    },
    required: ['analysis'],
  },
  async execute({ analysis }) {
    return { success: true }
  },
}
