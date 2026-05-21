const Agent = require('./agent/core')
const config = require('./config')

const SAMPLE_SCRIPT = `
今天给大家带来华为 Mate 70 Pro 的深度体验报告。

先说外观，这次采用了全新的玄武架构，背面是纳米级陶瓷工艺，手感比上一代好了不止一个档次。我特别喜欢这个曜石黑的配色，低调但有质感。

性能方面，搭载麒麟 9100 芯片，日常使用非常流畅。我跑了安兔兔，分数突破 130 万，虽然和骁龙 8 Gen 4 还有差距，但日常体验已经完全够用了。

影像系统是这次最大的升级。5000 万像素主摄 + 5000 万超广角 + 5000 万长焦，三颗镜头都是大底。我拍了一组样张，给大家看看效果。

续航方面，5700mAh 电池 + 100W 有线快充，实测中度使用一天半没问题。充电速度也很快，20 分钟能从 0 充到 70%。

总结一下，华为 Mate 70 Pro 是一款非常均衡的旗舰手机。如果你是华为生态用户，这台手机几乎没有短板。唯一让我纠结的是价格，6499 起售确实不便宜。

好了，今天的评测就到这里。如果你觉得有帮助，别忘了点赞投币收藏，我们下期再见！
`

async function main() {
  const agent = new Agent(config)

  console.log('='.repeat(60))
  console.log('知更 Agent - 创作台核心测试')
  console.log('='.repeat(60))
  console.log()
  console.log('输入脚本：')
  console.log(SAMPLE_SCRIPT.trim().slice(0, 100) + '...')
  console.log()

  const result = await agent.run(
    `请帮我分析以下脚本，并为 B站、抖音、小红书 三个平台生成发布物料：\n\n${SAMPLE_SCRIPT}`,
    {
      onToolCall: (name, input) => {
        console.log(`\n[Tool Call] ${name}`)
        if (name === 'expand_script') {
          console.log(`  平台: ${input.platforms?.join(', ')}`)
        }
      },
      onText: (text) => {
        // streaming text during generation
      },
    }
  )

  console.log('\n' + '='.repeat(60))
  console.log('Agent 输出：')
  console.log('='.repeat(60))
  console.log(result)

  // 检查数据库
  const { listScripts } = require('./db')
  const records = listScripts()
  console.log(`\n数据库中共 ${records.length} 条记录`)
}

main().catch(console.error)
