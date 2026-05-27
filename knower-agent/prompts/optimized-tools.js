// ============================================================
//  优化后的工具描述（基于 Superpowers Skill 模式）
// ============================================================
// 优化点：
//   1. 每个工具增加「什么时候必须调用」和「什么时候不要调用」
//   2. 增加示例调用场景
//   3. 增加常见错误提示
//   4. description 更明确触发条件
// ============================================================

const optimizedTools = [
  {
    name: 'crawl_data',
    description: `爬取指定平台的公开数据。支持按关键词搜索或爬取创作者主页。

**什么时候必须调用：**
- 用户提到"分析UP主/创作者/博主/账号" + 平台名或UID
- 用户说"帮我看看这个人的数据"
- 用户说"爬一下B站/抖音/小红书/微博的数据"

**什么时候不要调用：**
- 用户只是随口提到了一个平台名，但没有分析意图
- 用户说"我之前爬过的数据"（应该用 query_data）

**常见错误：**
- 用户只说了"分析UP主"但没给UID -> 不要猜，先调用 request_user_input
- 用户说"分析B站"但没给具体目标 -> 先确认是关键词搜索还是创作者主页`,
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['bili', 'dy', 'xhs', 'wb'],
          description: '平台：bili=B站, dy=抖音, xhs=小红书, wb=微博',
        },
        keyword: {
          type: 'string',
          description: '搜索关键词（关键词搜索模式时使用）。如果用户给了关键词，用这个。',
        },
        creatorUid: {
          type: 'string',
          description: '创作者 UID（创作者主页模式时使用）。如果用户给了UID，用这个。',
        },
        maxNotes: {
          type: 'number',
          description: '最大爬取数量，默认 15。一般用户不需要指定。',
        },
      },
      required: ['platform'],
      examples: [
        {
          description: '爬取B站UP主主页',
          input: { platform: 'bili', creatorUid: '440609243' },
        },
        {
          description: '在抖音搜索关键词',
          input: { platform: 'dy', keyword: '数码测评', maxNotes: 10 },
        },
      ],
    },
  },

  {
    name: 'query_data',
    description: `查询用户已有的爬取数据。这些数据是之前通过 crawl_data 爬取并保存到本地数据库的。

**什么时候必须调用：**
- 用户说"看看我的数据"、"我之前爬的"、"数据库里有什么"
- 用户说"查一下B站的数据"

**什么时候不要调用：**
- 用户说"分析这个UP主"（应该用 crawl_data 先爬取）
- 用户说"爬一下数据"（应该用 crawl_data）

**常见错误：**
- 用户说"看看B站数据"但数据库里没有 -> 诚实说"暂无数据，需要先爬取"`,
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['bili', 'dy', 'xhs', 'wb', 'all'],
          description: '平台，all 表示所有平台',
        },
        sourceUid: {
          type: 'string',
          description: '来源 UID（可选，不填则查全部来源）',
        },
        limit: {
          type: 'number',
          description: '返回条数，默认 20',
        },
      },
    },
  },

  {
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
          description: '脚本分析结果。基于用户提供的脚本内容，填写以下字段。',
          properties: {
            videoType: { type: 'string', description: '视频类型（如：科技测评/vlog/教程/开箱）' },
            topic: { type: 'string', description: '核心主题（一句话概括）' },
            audience: { type: 'string', description: '目标受众描述' },
            duration: { type: 'string', description: '预估视频时长' },
            keyPoints: { type: 'array', items: { type: 'string' }, description: '核心卖点列表（至少3个）' },
          },
          required: ['videoType', 'topic', 'audience', 'duration', 'keyPoints'],
        },
      },
      required: ['analysis'],
    },
  },

  {
    name: 'expand_script',
    description: `基于脚本分析结果，为各平台生成发布物料。这是"脚本->物料"流程的第二步（必须在 analyze_script 之后调用）。

**什么时候必须调用：**
- analyze_script 已完成，需要生成各平台物料
- 用户说"生成物料"、"出标题"、"写文案"

**什么时候不要调用：**
- 还没有调用 analyze_script（必须先分析）
- 用户只是想分析脚本，不需要生成物料

**常见错误：**
- 没有先调用 analyze_script 就直接调用 -> 不行，必须有分析结果
- 物料不符合平台规范（标题太长、缺少钩子）-> 严格遵守平台规范`,
    input_schema: {
      type: 'object',
      properties: {
        result: {
          type: 'object',
          description: '各平台物料。必须包含所有平台。',
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
              description: 'B站物料：标题<=80字，描述<=200字，标签5-8个',
              properties: {
                title: { type: 'string', description: '标题（<=80字，专业感+信息量）' },
                description: { type: 'string', description: '描述（<=200字）' },
                tags: { type: 'array', items: { type: 'string' }, description: '标签5-8个' },
              },
            },
            youtube: {
              type: 'object',
              description: 'YouTube物料：标题<=60字符，描述前两行最关键',
              properties: {
                title: { type: 'string', description: '标题（<=60字符，SEO友好）' },
                description: { type: 'string', description: '描述（<=5000字符，含时间戳）' },
                tags: { type: 'array', items: { type: 'string' }, description: '标签5-15个，中英混合' },
              },
            },
            douyin: {
              type: 'object',
              description: '抖音物料：标题<=55字，前3秒钩子必须有',
              properties: {
                hook: { type: 'string', description: '前3秒钩子文案（制造好奇/冲突/反转）' },
                title: { type: 'string', description: '标题（<=55字，口语化有冲击力）' },
                tags: { type: 'array', items: { type: 'string' }, description: '标签3-5个' },
              },
            },
            xiaohongshu: {
              type: 'object',
              description: '小红书物料：封面标题<=20字必须带emoji',
              properties: {
                coverTitle: { type: 'string', description: '封面标题（<=20字，必须带emoji）' },
                body: { type: 'string', description: '正文（口语化，像朋友聊天）' },
                tags: { type: 'array', items: { type: 'string' }, description: '标签5-8个，偏生活化' },
              },
            },
          },
        },
      },
      required: ['result'],
    },
  },

  {
    name: 'suggest_topics',
    description: `结合用户历史数据和平台趋势，生成个性化选题建议。工具内部会自动查询历史数据和趋势。

**什么时候必须调用：**
- 用户说"选题"、"灵感"、"brainstorm"、"做什么内容"、"帮我想想"
- 用户说"有什么好的选题"

**什么时候不要调用：**
- 用户只是在讨论某个具体话题（闲聊）
- 用户说"分析这个选题好不好"（这不是生成选题，是评估）

**常见错误：**
- 用户说"推荐选题"但没说平台 -> 默认用 bilibili，但最好先确认`,
    input_schema: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: '目标平台（bili/dy/xhs/wb）' },
        count: { type: 'number', description: '生成选题数量，默认 5' },
      },
      required: ['platform'],
    },
  },

  {
    name: 'save_result',
    description: `将脚本分析结果和生成的各平台物料存入本地 SQLite 数据库。这是"脚本->物料"流程的最后一步（必须在 expand_script 之后调用）。

**什么时候必须调用：**
- 已经生成了物料（调用了 expand_script），需要保存
- 用户说"保存"、"记录一下"、"存起来"

**什么时候不要调用：**
- 还没有生成物料（没有 analyze_script + expand_script 的结果）
- 用户明确说"不要保存"

**常见错误：**
- 物料不完整就保存 -> 必须有完整的 analysis + result
- 忘记保存 -> 生成了物料就必须保存，除非用户说不要`,
    input_schema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: '原始脚本文本（用户提供的完整脚本内容）',
        },
        analysis: {
          type: 'object',
          description: '脚本分析结果（来自 analyze_script 的输出）',
          properties: {
            videoType: { type: 'string' },
            topic: { type: 'string' },
            audience: { type: 'string' },
            duration: { type: 'string' },
            keyPoints: { type: 'array', items: { type: 'string' } },
          },
          required: ['videoType', 'topic', 'audience', 'duration', 'keyPoints'],
        },
        result: {
          type: 'object',
          description: '各平台发布物料（来自 expand_script 的输出）',
          properties: {
            shootingChecklist: { type: 'array', items: { type: 'object' } },
            bilibili: { type: 'object' },
            youtube: { type: 'object' },
            douyin: { type: 'object' },
            xiaohongshu: { type: 'object' },
          },
        },
      },
      required: ['script', 'analysis', 'result'],
    },
  },

  {
    name: 'request_user_input',
    description: `当需要用户确认或补充信息时调用。定义表单字段，前端会弹出表单让用户填写。

**什么时候必须调用：**
- 缺少执行任务的必要信息（如：没给UID、没给脚本、没确认平台）
- 需要用户选择（如：要爬哪个平台、要生成哪些平台的物料）

**什么时候不要调用：**
- 信息已经足够，可以直接执行
- 用户只是在闲聊

**常见错误：**
- 信息够了还调用 -> 不要多此一举，直接执行
- 信息不够但不调用 -> 不要猜，必须问清楚`,
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
  },
]

module.exports = { optimizedTools }