module.exports = {
  name: 'analyze_script',
  description: '分析脚本结构，将分析结果作为工具参数传递。调用时在 analysis 参数中填入完整的分析结果 JSON。',
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
