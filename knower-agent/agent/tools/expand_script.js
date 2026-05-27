module.exports = {
  name: 'expand_script',
  description: '基于脚本分析结果，为各平台生成发布物料。调用时在 result 参数中填入完整的物料 JSON。',
  input_schema: {
    type: 'object',
    properties: {
      result: {
        type: 'object',
        description: '各平台物料',
        properties: {
          shootingChecklist: {
            type: 'array',
            description: '拍摄清单',
            items: {
              type: 'object',
              properties: {
                scene: { type: 'string', description: '景别（特写/中景/全景/俯拍）' },
                content: { type: 'string', description: '拍摄内容' },
                duration: { type: 'string', description: '预估秒数' },
                notes: { type: 'string', description: '备注' },
              },
            },
          },
          bilibili: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '标题（≤80字）' },
              description: { type: 'string', description: '描述（≤200字）' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
          youtube: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '标题（≤60字符）' },
              description: { type: 'string', description: '描述（≤5000字符）' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
          douyin: {
            type: 'object',
            properties: {
              hook: { type: 'string', description: '前3秒钩子文案' },
              title: { type: 'string', description: '标题（≤55字）' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
          xiaohongshu: {
            type: 'object',
            properties: {
              coverTitle: { type: 'string', description: '封面标题（≤20字，带emoji）' },
              body: { type: 'string', description: '正文' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    required: ['result'],
  },
  async execute({ result }) {
    return { success: true }
  },
}
