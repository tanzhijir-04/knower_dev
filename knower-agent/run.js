// 供 Electron 主进程 spawn 调用的 Agent 运行器
// 输入：stdin JSON { script, platforms }
// 输出：stdout 流式 JSON 事件

const Agent = require('./agent/core')

let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', async () => {
  try {
    const { script, platforms } = JSON.parse(input)
    const agent = new Agent()

    for await (const event of agent.stream(
      `请帮我分析以下脚本，并为 ${platforms.join('、')} 三个平台生成发布物料：\n\n${script}`,
      { platforms }
    )) {
      process.stdout.write(JSON.stringify(event) + '\n')
    }

    process.stdout.write(JSON.stringify({ type: 'done' }) + '\n')
  } catch (err) {
    process.stdout.write(JSON.stringify({ type: 'error', message: err.message }) + '\n')
    process.exit(1)
  }
})
