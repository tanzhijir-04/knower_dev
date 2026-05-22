# 爬虫模块

MediaCrawler 多平台爬虫集成，支持 B站、抖音、小红书、微博。

## 快速开始

### 1. 初始化环境

```bash
# Windows
setup_env.bat

# macOS/Linux
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

### 2. 命令行测试

```bash
# 搜索 B站视频
python run_crawler.py --platform bili --keywords "编程" --max-notes 5

# 搜索抖音视频
python run_crawler.py --platform dy --keywords "美食" --max-notes 5

# 搜索小红书笔记
python run_crawler.py --platform xhs --keywords "旅行" --max-notes 5

# 搜索微博
python run_crawler.py --platform wb --keywords "新闻" --max-notes 5
```

### 3. Node.js 调用

```javascript
const { runCrawler } = require('./lib/crawler');

const result = await runCrawler('bili', '编程', {
  maxNotes: 10,
  headless: true,
  getComment: false,
  crawlerType: 'search'
});

console.log(result.contents);  // 视频列表
console.log(result.creators);  // 创作者信息
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--platform` | 平台：bili, dy, xhs, wb | 必填 |
| `--keywords` | 搜索关键词 | 空 |
| `--crawler-type` | 爬取类型：search, detail, creator | search |
| `--max-notes` | 最大爬取数量 | 15 |
| `--max-comments` | 每条内容最大评论数 | 10 |
| `--get-comment` | 是否爬取评论 | false |
| `--headless` | 无头模式 | true |
| `--no-headless` | 显示浏览器 | - |
| `--specified-id` | 指定内容ID（逗号分隔） | 空 |
| `--creator-id` | 指定创作者ID（逗号分隔） | 空 |

## 输出格式

```json
{
  "platform": "bili",
  "keywords": "编程",
  "crawler_type": "search",
  "contents": [
    {
      "video_id": "123456",
      "title": "视频标题",
      "desc": "视频描述",
      "nickname": "UP主名称",
      "user_id": "789",
      "liked_count": "1000",
      "video_play_count": "50000",
      "video_comment": "100",
      "create_time": 1700000000,
      "video_url": "https://www.bilibili.com/video/av123456"
    }
  ],
  "creators": [
    {
      "user_id": "789",
      "nickname": "UP主名称",
      "total_fans": 100000,
      "total_liked": 500000
    }
  ],
  "comments": [],
  "stats": {
    "total_contents": 20,
    "total_comments": 0,
    "total_creators": 20
  }
}
```

## 注意事项

1. **首次登录**：会弹出浏览器扫码登录，登录状态保存在 `mediasrc/login_state/`
2. **依赖**：需要 Node.js（抖音签名）、Python 3.11+、Playwright
3. **编码**：Windows 下已处理 UTF-8 编码问题
4. **CDP 模式**：默认关闭，如需使用远程 Chrome，请修改 `mediasrc/config/base_config.py`

## 目录结构

```
crawler/
├── mediasrc/           # MediaCrawler 精简副本
│   ├── base/           # 爬虫基类
│   ├── config/         # 配置
│   ├── tools/          # 工具函数
│   ├── media_platform/ # 平台爬虫实现
│   ├── store/          # 数据存储
│   └── libs/           # JS 签名脚本
├── run_crawler.py      # CLI 入口
├── requirements.txt    # Python 依赖
└── setup_env.bat       # 环境初始化
```
