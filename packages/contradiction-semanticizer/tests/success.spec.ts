import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import Memory from '@deepseek-ai/dsh-memory'
import { name, inject, Config, apply } from '../src/index.ts'

/** Minimal `llm` stand-in; the success path never calls it. */
class FakeLlm extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llm')
  }
}

describe('contradiction-semanticizer success library', () => {
  it('records a success record for a successful self-referential call', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(FakeLlm)
    await ctx.plugin({ name, inject, Config, apply }, {
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      maxLessonWords: 50,
      selfReferenceToolPrefix: 'cordis',
      recordSuccess: true,
    })

    // A successful self-referential call is observed via the scoped `tools/result`
    // emit; the listener is global (untagged), so a plain emit reaches it.
    await ctx.emit('tools/result', { name: 'cordis_define' } as never, { isError: false, content: [] } as never)

    const records = ctx.memory.listRecords()
    expect(records).toHaveLength(1)
    expect(records[0]!.type).toBe('success')
    expect(records[0]!.tags).toEqual(['success'])
  })

  it('does not record success when recordSuccess is disabled', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    await ctx.plugin(FakeLlm)
    await ctx.plugin({ name, inject, Config, apply }, {
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      maxLessonWords: 50,
      selfReferenceToolPrefix: 'cordis',
      recordSuccess: false,
    })

    await ctx.emit('tools/result', { name: 'cordis_define' } as never, { isError: false, content: [] } as never)
    expect(ctx.memory.listRecords()).toEqual([])
  })
})
