import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Memory from '@deepseek-ai/dsh-memory'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { agentEvents } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as lessonInjector from '../src/index.ts'

const SIGNAL = new AbortController().signal
const agent = { id: 'a1' } as unknown as Agent

const DEFAULT_CONFIG: lessonInjector.Config = {
  sectionName: 'self-evolution:lessons',
  order: 300,
  maxLessons: 3,
  minSeverity: 'beta',
}

async function mount(config: lessonInjector.Config = DEFAULT_CONFIG): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(Memory)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(lessonInjector, config)
  return ctx
}

function fire(ctx: Context, text: string) {
  const proposed = createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  })
  return agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [proposed], turn: 1, step: 1, signal: SIGNAL },
    () => Promise.resolve({ kind: 'enter' as const, messages: [proposed] }),
  )
}

describe('lesson-injector agent/pre-step', () => {
  it('prepends a relevance block when the claimed text matches a stored lesson', async () => {
    const ctx = await mount()
    ctx.memory.recordFingerprint({
      type: 'gamma',
      triggerOp: 'cordis_define',
      semanticLesson: '返回对象误用 `});` 闭合导致语法错误',
      causalChain: [],
    })

    const decision = await fire(ctx, 'cordis_define 语法错误')

    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(decision.messages).toHaveLength(2)
    const injected = decision.messages[0]!
    expect(injected.source.kind).toBe('plugin')
    if (injected.source.kind === 'plugin') {
      expect(injected.source.plugin).toBe('lesson-injector')
    }
    const text = injected.content.find(block => block.type === 'text')
    expect(text?.type === 'text' ? text.text : '').toContain('【相关记忆】')
  })

  it('delegates unchanged when no stored lesson is relevant', async () => {
    const ctx = await mount()
    ctx.memory.recordFingerprint({
      type: 'gamma',
      triggerOp: 'cordis_define',
      semanticLesson: '返回对象误用 `});` 闭合导致语法错误',
      causalChain: [],
    })

    const decision = await fire(ctx, '金融数据 报表')

    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(decision.messages).toHaveLength(1)
  })

  it('delegates without injecting when the downstream step is rejected', async () => {
    const ctx = await mount()
    ctx.memory.recordFingerprint({
      type: 'gamma',
      triggerOp: 'cordis_define',
      semanticLesson: '返回对象误用 `});` 闭合导致语法错误',
      causalChain: [],
    })

    const proposed = createUserMessage({
      content: [{ type: 'text', text: 'cordis_define 语法错误' }],
      source: { kind: 'user' },
    })
    const decision = await agentEvents(ctx, agent).waterfall(
      'agent/pre-step',
      { messages: [proposed], turn: 1, step: 1, signal: SIGNAL },
      () => Promise.resolve({ kind: 'reject' as const }),
    )

    expect(decision.kind).toBe('reject')
  })
})
