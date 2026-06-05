module.exports = {
  name: 'record_review',
  description: '记录内容发布后的实际表现数据，用于复盘分析',
  input_schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb', 'youtube'] },
      title: { type: 'string' },
      publishDate: { type: 'string' },
      views: { type: 'number' }, likes: { type: 'number' }, comments: { type: 'number' },
      saves: { type: 'number' }, shares: { type: 'number' }, newFollowers: { type: 'number' },
      rating: { type: 'number' },
    },
    required: ['platform', 'title'],
  },
  async execute(params) {
    const { createReview } = require('../../db')
    await createReview(params)
    return { ok: true, message: '已记录「' + params.title + '」' }
  },
}
