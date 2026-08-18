import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import TimerService from '@deepseek-ai/cordis-plugin-timer'
import Memory from '@deepseek-ai/dsh-memory'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { apply, Config, ideaPrompt, inject, name, normalizeKind, parseIdea } from '../src/index.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeKind', () => {
  it('keeps every legal idea kind', () => {
    for (const kind of ['thought', 'evolution', 'writing', 'chat', 'inspiration']) {
      expect(normalizeKind(kind)).toBe(kind)
    }
  })

  it('falls back to `thought` for an unknown kind', () => {
    expect(normalizeKind('hack')).toBe('thought')
    expect(normalizeKind('')).toBe('thought')
  })
})

describe('parseIdea', () => {
  it('parses clean JSON', () => {
    expect(parseIdea('{"kind":"writing","content":"一个小说的开头"}')).toEqual({
      kind: 'writing',
      content: '一个小说的开头',
    })
  })

  it('parses JSON wrapped in a code fence', () => {
    const idea = parseIdea('```json\n{"kind":"evolution","content":"改进记忆检索"}\n```')
    expect(idea).toEqual({ kind: 'evolution', content: '改进记忆检索' })
  })

  it('falls back to a `thought` carrying the raw text', () => {
    const idea = parseIdea('（没有 JSON 的散乱文字）')
    expect(idea.kind).toBe('thought')
    expect(idea.content).toContain('散乱')
  })
})

describe('ideaPrompt', () => {
  it('names the heartbeat and every idea kind', () => {
    const prompt = ideaPrompt()
    expect(prompt).toContain('有心跳')
    for (const kind of ['thought', 'evolution', 'writing', 'chat', 'inspiration']) {
      expect(prompt).toContain(kind)
    }
  })
})

/** Minimal `llm` stand-in that always produces one idea. */
class FakeLlm extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llm')
  }

  async * stream(): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: '{"kind":"inspiration","content":"一个突如其来的灵感"}' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const CONFIG = {
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  heartbeatMs: 1000,
  thinkCooldownMs: 3000,
  reasoningEffort: 'max',
  maxTokens: 4096,
} satisfies Config

describe('heartbeat composition', () => {
  it('beats, thinks, records the idea, and emits heartbeat/idea', async () => {
    vi.useFakeTimers()
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(TimerService)
    await ctx.plugin(FakeLlm)
    await ctx.plugin({ name, inject, Config, apply }, CONFIG)

    const emitted: unknown[] = []
    ctx.on('heartbeat/idea', idea => emitted.push(idea))

    // First beat fires after heartbeatMs; the initial cooldown has elapsed, so
    // it also thinks once.
    await vi.advanceTimersByTimeAsync(CONFIG.heartbeatMs)
    // Flush the async idea-generation and recording.
    await vi.advanceTimersByTimeAsync(0)

    const records = ctx.memory.listRecords()
    expect(records.some(record => record.type === 'thought' && record.tags.includes('heartbeat'))).toBe(true)
    expect(emitted).toHaveLength(1)
  })

  it('does not think again inside the cooldown window', async () => {
    vi.useFakeTimers()
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(TimerService)
    await ctx.plugin(FakeLlm)
    await ctx.plugin({ name, inject, Config, apply }, CONFIG)

    // Two beats within one cooldown window → only one thought.
    await vi.advanceTimersByTimeAsync(CONFIG.heartbeatMs)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(CONFIG.heartbeatMs)
    await vi.advanceTimersByTimeAsync(0)

    const thoughts = ctx.memory.listRecords().filter(record => record.type === 'thought')
    expect(thoughts).toHaveLength(1)
  })
})
