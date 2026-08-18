/**
 * 进化效果基准（A/B）：度量「相关教训注入」是否提升模型在同类易错任务上的正确率。
 *
 * 两个条件对每个任务各采样 N 次：
 *   - 无教训（baseline）：system 只含中性提示。
 *   - 有教训（injected）：system 额外带一段【相关记忆】教训块（模拟 lesson-injector 被动注入）。
 *
 * 用规则 judge（关键词匹配）判对错，输出 markdown 报告到 stdout 与 bench/REPORT.md。
 *
 * 运行：DEEPSEEK_API_KEY=sk-... node bench/run-bench.mjs [N]
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TASKS } from './tasks.mjs'

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL = 'deepseek-v4-flash'
const API_KEY = process.env.DEEPSEEK_API_KEY
const N = Number.parseInt(process.argv[2] ?? '3', 10) || 3
const CONCURRENCY = 4
const __dirname = dirname(fileURLToPath(import.meta.url))

if (!API_KEY) {
  console.error('缺少 DEEPSEEK_API_KEY 环境变量')
  process.exit(1)
}

const NEUTRAL_SYSTEM = '你是 DeepSeek Harness 的插件开发助手。请简洁、直接地回答用户问题，不要展开无关内容。'

function injectedSystem(lesson) {
  return `${NEUTRAL_SYSTEM}\n\n【相关记忆】以下经验教训与你当前的任务高度相关，请据此规避过往错误：\n[教训1] ${lesson}`
}

async function ask(system, user) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
      max_tokens: 256,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

async function askWithRetry(system, user, retries = 3) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await ask(system, user)
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
  throw lastError
}

function judge(task, answer) {
  for (const bad of task.reject) {
    if (answer.includes(bad)) return false
  }
  for (const good of task.expect) {
    if (answer.includes(good)) return true
  }
  return false
}

/** 简单并发池：最多 CONCURRENCY 个 in-flight 任务。 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let index = 0
  async function worker() {
    while (true) {
      const i = index
      index += 1
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}

const samples = []
for (const task of TASKS) {
  for (let n = 0; n < N; n += 1) {
    samples.push({ task, condition: 'baseline' })
    samples.push({ task, condition: 'injected' })
  }
}

const outcomes = await mapLimit(samples, CONCURRENCY, async ({ task, condition }) => {
  const system = condition === 'baseline' ? NEUTRAL_SYSTEM : injectedSystem(task.lesson)
  try {
    const answer = await askWithRetry(system, task.question)
    return { task, condition, correct: judge(task, answer), answer }
  } catch (error) {
    return { task, condition, correct: false, answer: `[ERROR] ${String(error)}` }
  }
})

function tally(taskId) {
  let baseCorrect = 0
  let injectedCorrect = 0
  for (const outcome of outcomes) {
    if (outcome.task.id !== taskId) continue
    if (outcome.condition === 'baseline' && outcome.correct) baseCorrect += 1
    if (outcome.condition === 'injected' && outcome.correct) injectedCorrect += 1
  }
  return { baseCorrect, injectedCorrect }
}

const rows = TASKS.map((task) => {
  const { baseCorrect, injectedCorrect } = tally(task.id)
  const gain = injectedCorrect - baseCorrect
  return {
    task,
    base: baseCorrect,
    injected: injectedCorrect,
    gain,
  }
})

const totalBase = rows.reduce((sum, row) => sum + row.base, 0)
const totalInjected = rows.reduce((sum, row) => sum + row.injected, 0)
const totalSamples = TASKS.length * N
const improved = rows.filter(row => row.gain > 0).length
const regressed = rows.filter(row => row.gain < 0).length

const pct = (count, total) => `${count}/${total} (${((count / total) * 100).toFixed(0)}%)`

const lines = []
lines.push('# 进化效果基准报告（教训注入 A/B）')
lines.push('')
lines.push(`- 生成时间：${new Date().toISOString()}`)
lines.push(`- 模型：\`${MODEL}\`（thinking 关闭）`)
lines.push(`- 每任务每条件采样：${N} 次`)
lines.push(`- 任务数：${TASKS.length}`)
lines.push('')
lines.push('## 总览')
lines.push('')
lines.push('| 条件 | 正确率 |')
lines.push('|---|---|')
lines.push(`| 无教训（baseline） | ${pct(totalBase, totalSamples)} |`)
lines.push(`| 有教训（injected） | ${pct(totalInjected, totalSamples)} |`)
lines.push('')
lines.push(`- 提升任务：${improved} / ${TASKS.length}`)
lines.push(`- 退步任务：${regressed} / ${TASKS.length}`)
lines.push(`- 净提升：${totalInjected - totalBase} / ${totalSamples}`)
lines.push('')
lines.push('## 分任务对比')
lines.push('')
lines.push('| 任务 | 无教训 | 有教训 | 变化 |')
lines.push('|---|---|---|---|')
for (const row of rows) {
  const delta = row.gain > 0 ? `+${row.gain}` : String(row.gain)
  lines.push(`| ${row.task.title} | ${pct(row.base, N)} | ${pct(row.injected, N)} | ${delta} |`)
}
lines.push('')
lines.push('## 说明')
lines.push('')
lines.push('本基准度量的是「教训文本对模型行为的影响」，是进化增益的代理指标，不是完整「犯错→蒸馏→重犯」闭环的直接度量。')
lines.push('正确性由规则 judge（关键词匹配）判定，两个条件使用同一 judge，因此差值方向可信，绝对正确率仅供参考。')
lines.push('')
lines.push('## 逐条原始回答')
lines.push('')
for (const task of TASKS) {
  lines.push(`### ${task.title}（${task.id}）`)
  lines.push('')
  for (const condition of ['baseline', 'injected']) {
    const label = condition === 'baseline' ? '无教训' : '有教训'
    lines.push(`**${label}：**`)
    lines.push('')
    for (const outcome of outcomes.filter(o => o.task.id === task.id && o.condition === condition)) {
      const mark = outcome.correct ? '✅' : '❌'
      lines.push(`- ${mark} ${outcome.answer}`)
    }
    lines.push('')
  }
}

const report = lines.join('\n')
console.log(report)
writeFileSync(join(__dirname, 'REPORT.md'), report, 'utf8')
console.error(`\n报告已写入 bench/REPORT.md`)
