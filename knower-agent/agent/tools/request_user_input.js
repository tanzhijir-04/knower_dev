module.exports = {
  name: 'request_user_input',
  description: '当需要用户确认或补充信息时调用。定义表单字段，前端会弹出表单让用户填写。',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: '向用户展示的说明文字' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '字段名（英文key）' },
            label: { type: 'string', description: '显示给用户的字段标签' },
            type: { type: 'string', enum: ['text', 'select'], description: '字段类型' },
            options: { type: 'array', items: { type: 'string' }, description: 'select 的选项' },
            placeholder: { type: 'string' },
            required: { type: 'boolean' },
          },
          required: ['name', 'label', 'type'],
        },
      },
    },
    required: ['message', 'fields'],
  },
  async execute(input) {
    return {
      formRequest: true,
      message: input.message,
      fields: input.fields,
    }
  },
}
