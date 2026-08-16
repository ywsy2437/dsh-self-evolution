import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Memory from '../src/index.ts'

describe('Memory service', () => {
  it('mounts on the context', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)
    expect(ctx.memory).toBeInstanceOf(Memory)
  })

  it('folds a repeated (type, triggerOp) contradiction into one fingerprint', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    const first = ctx.memory.recordFingerprint({
      type: 'gamma',
      triggerOp: 'config_update/memory_manager/temperature',
      semanticLesson: 'first lesson',
      causalChain: ['op', 'state', 'contradiction'],
    })
    const second = ctx.memory.recordFingerprint({
      type: 'gamma',
      triggerOp: 'config_update/memory_manager/temperature',
      semanticLesson: 'second lesson',
      causalChain: ['op', 'state', 'contradiction'],
    })

    expect(second.id).toBe(first.id)
    expect(second.occurrenceCount).toBe(2)
    expect(second.lastOccurrence).toBeGreaterThanOrEqual(first.lastOccurrence)
    expect(second.semanticLesson).toBe('second lesson')
  })

  it('queries recent contradictions by minimum severity, most recent first', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    ctx.memory.recordFingerprint({ type: 'alpha', triggerOp: 'a', semanticLesson: 'a', causalChain: [] })
    ctx.memory.recordFingerprint({ type: 'beta', triggerOp: 'b', semanticLesson: 'b', causalChain: [] })
    ctx.memory.recordFingerprint({ type: 'gamma', triggerOp: 'g', semanticLesson: 'g', causalChain: [] })

    const betaAndUp = ctx.memory.queryRecentContradictions(10, 'beta')
    expect(betaAndUp.map(f => f.type).sort()).toEqual(['beta', 'gamma'])
    const gammaOnly = ctx.memory.queryRecentContradictions(10, 'gamma')
    expect(gammaOnly.map(f => f.type)).toEqual(['gamma'])
  })

  it('separates resolved fingerprints from unsolved queries', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    const unresolved = ctx.memory.recordFingerprint({ type: 'gamma', triggerOp: 'x', semanticLesson: 'x', causalChain: [] })
    ctx.memory.recordFingerprint({ type: 'gamma', triggerOp: 'y', semanticLesson: 'y', causalChain: [] })
    ctx.memory.markResolved(unresolved.id, 'patch-1')

    const unsolved = ctx.memory.queryUnsolvedContradictions('gamma', 10)
    expect(unsolved).toHaveLength(1)
    expect(unsolved[0]!.triggerOp).toBe('y')
  })

  it('records generic meta-memory records with assigned id and timestamp', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    const record = ctx.memory.record({ type: 'shadow_failure', payload: { ok: false }, tags: ['candidate_strategy', 'failed'] })
    expect(record.id).toBeTruthy()
    expect(record.timestamp).toBeGreaterThan(0)
    expect(ctx.memory.listRecords()).toEqual([record])
  })

  it('swaps a mounted store and restores on dispose', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    const store = {
      listFingerprints: () => [] as never[],
      saveFingerprint: () => {},
      listRecords: () => [] as never[],
      appendRecord: () => {},
    }
    const dispose = ctx.memory.mountStore(store)
    expect(ctx.memory.listRecords()).toEqual([])
    dispose()
    ctx.memory.record({ type: 't', payload: 1, tags: [] })
    expect(ctx.memory.listRecords().length).toBe(1)
  })
})
