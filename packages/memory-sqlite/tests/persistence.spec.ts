import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import Memory from '@deepseek-ai/dsh-memory'
import { name, inject, Config, apply } from '../src/index.ts'
import type { KvUnit, StorageBackend } from '@deepseek-ai/dsh-storage'

/** In-memory KV backend that exposes its tables for assertions. */
function makeBackend(): StorageBackend & { tables: Map<string, Map<string, unknown>> } {
  const tables = new Map<string, Map<string, unknown>>()
  const unit: KvUnit = {
    loadAll: async () => ({
      tables: Object.fromEntries([...tables].map(([table, rows]) => [table, Object.fromEntries(rows)])),
      global: null,
    }),
    putRecord: async (table, key, value) => {
      let rows = tables.get(table)
      if (rows === undefined) {
        rows = new Map()
        tables.set(table, rows)
      }
      rows.set(key, value)
    },
    deleteRecord: async () => {},
    setGlobal: async () => {},
    close: async () => {},
  }
  return Object.assign({ kv: { open: async () => unit }, close: async () => {} }, { tables })
}

describe('memory-sqlite', () => {
  it('writes fingerprints and records through to the KV backend', async () => {
    const ctx = new Context()
    await ctx.plugin(Storage)
    await ctx.plugin(Memory)
    const backend = makeBackend()
    ctx.storage.backend.register('test', backend)
    await ctx.plugin({ name, inject, Config, apply }, { backend: 'test', unitName: 'memory', version: 1 })

    const fingerprint = ctx.memory.recordFingerprint({ type: 'gamma', triggerOp: 'x', semanticLesson: 'lesson', causalChain: [] })
    ctx.memory.record({ type: 'evolution_patch', payload: { a: 1 }, tags: ['offline_reflector'] })

    expect(backend.tables.get('fingerprints')?.has(fingerprint.id)).toBe(true)
    expect(backend.tables.get('records')?.size).toBe(1)
  })

  it('loads a persisted snapshot on mount', async () => {
    const backend = makeBackend()
    backend.tables.set('fingerprints', new Map([['fp-1', {
      id: 'fp-1',
      type: 'beta',
      triggerOp: 't',
      semanticLesson: 'old lesson',
      causalChain: [],
      occurrenceCount: 1,
      lastOccurrence: 1,
    }]]))

    const ctx = new Context()
    await ctx.plugin(Storage)
    await ctx.plugin(Memory)
    ctx.storage.backend.register('test', backend)
    await ctx.plugin({ name, inject, Config, apply }, { backend: 'test', unitName: 'memory', version: 1 })

    const recent = ctx.memory.queryRecentContradictions(10, 'alpha')
    expect(recent).toHaveLength(1)
    expect(recent[0]!.semanticLesson).toBe('old lesson')
  })
})
