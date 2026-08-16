import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Memory from '@deepseek-ai/dsh-memory'
import { apply, classifyOutcome, name, inject } from '../src/index.ts'

describe('classifyOutcome', () => {
  it('maps completed to success', () => {
    expect(classifyOutcome('completed')).toBe('success')
  })

  it('maps error to failure', () => {
    expect(classifyOutcome('error')).toBe('failure')
  })

  it('maps aborted/blocked/max-tokens/interrupted to inconclusive', () => {
    expect(classifyOutcome('aborted')).toBe('inconclusive')
    expect(classifyOutcome('blocked')).toBe('inconclusive')
    expect(classifyOutcome('max-tokens')).toBe('inconclusive')
    expect(classifyOutcome('interrupted')).toBe('inconclusive')
  })
})

describe('task-evaluator', () => {
  it('records a task_outcome for a completed turn', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin({ name, inject, apply })

    await ctx.emit('session/event', {} as never, {
      type: 'turn/end',
      seq: 1,
      time: 1,
      data: { turn: 1, reason: { kind: 'completed' } },
    } as never)

    const records = ctx.memory.listRecords()
    expect(records).toHaveLength(1)
    expect(records[0]!.type).toBe('task_outcome')
    expect(records[0]!.tags).toEqual(['task_outcome', 'success'])
  })

  it('records failure for an errored turn', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin({ name, inject, apply })

    await ctx.emit('session/event', {} as never, {
      type: 'turn/end',
      seq: 1,
      time: 1,
      data: { turn: 1, reason: { kind: 'error', error: { message: 'boom', code: 'X' } } },
    } as never)

    expect(ctx.memory.listRecords()[0]!.tags).toEqual(['task_outcome', 'failure'])
  })

  it('ignores non turn/end session events', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin({ name, inject, apply })

    await ctx.emit('session/event', {} as never, { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } } as never)
    expect(ctx.memory.listRecords()).toEqual([])
  })
})
