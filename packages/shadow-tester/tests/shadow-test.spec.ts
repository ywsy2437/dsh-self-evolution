import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import Memory from '@deepseek-ai/dsh-memory'
import ShadowTester from '../src/index.ts'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SubagentResult, SubagentRun } from '@deepseek-ai/dsh-subagent'

/** Fake subagents service whose `start` returns a pre-seeded run. */
class FakeSubagents extends Service {
  constructor(ctx: Context, private readonly seeded: SubagentResult) {
    super(ctx, 'subagents')
  }

  async start(): Promise<SubagentRun> {
    return {
      id: 'run-1' as never,
      localAgent: undefined,
      result: Promise.resolve(this.seeded),
      dispose: async () => {},
    }
  }
}

function completedResult(text: string, stopReason: SubagentResult['stopReason'] = 'completed'): SubagentResult {
  return { output: [{ type: 'text', text }], stopReason }
}

const parent = {} as Agent

describe('ShadowTester', () => {
  it('passes a completed child that reports PASS', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(FakeSubagents, completedResult('PASS'))
    await ctx.plugin(ShadowTester)

    const result = await ctx.shadowTester.shadowTest({ toolName: 'cordis_define', description: 'add a plugin' }, parent, new AbortController().signal)
    expect(result.passed).toBe(true)
    expect(ctx.memory.listRecords()).toEqual([])
  })

  it('fails and records a shadow_failure when the child reports FAIL', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(FakeSubagents, completedResult('FAIL: 数据结构不兼容'))
    await ctx.plugin(ShadowTester)

    const result = await ctx.shadowTester.shadowTest({ toolName: 'cordis_run', description: 'migrate' }, parent, new AbortController().signal)
    expect(result.passed).toBe(false)
    const records = ctx.memory.listRecords()
    expect(records).toHaveLength(1)
    expect(records[0]!.type).toBe('shadow_failure')
  })

  it('fails and records a shadow_failure when the child does not complete', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(FakeSubagents, completedResult('', 'error'))
    await ctx.plugin(ShadowTester)

    const result = await ctx.shadowTester.shadowTest({ toolName: 'cordis_run', description: 'x' }, parent, new AbortController().signal)
    expect(result.passed).toBe(false)
    expect(ctx.memory.listRecords()).toHaveLength(1)
  })

  it('fails gracefully when the subagents service is absent', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(ShadowTester)

    const result = await ctx.shadowTester.shadowTest({ toolName: 'cordis_run', description: 'x' }, parent, new AbortController().signal)
    expect(result.passed).toBe(false)
    expect(result.warnings[0]).toContain('subagents')
  })
})
