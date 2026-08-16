/**
 * Durable meta-memory store: mounts a {@link MemoryStore} over a storage KV
 * backend (`sqlite` by default). On mount it loads the full snapshot into
 * process memory so the synchronous {@link MemoryStore} reads stay fast, then
 * writes each mutation through to the backend (fire-and-forget durability).
 *
 * @module @deepseek-ai/dsh-memory-sqlite
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ContradictionFingerprint, MemoryRecord, MemoryStore } from '@deepseek-ai/dsh-memory'
// Type-only: loads the `ctx.storage` augmentation.
import type {} from '@deepseek-ai/dsh-storage'

export const name = 'memory-sqlite'
export const inject = ['storage', 'memory']

/** Model-facing persistence configuration. */
export interface Config {
  /** Storage backend name that serves the KV facet. */
  backend: string
  /** KV unit name under which fingerprints and records are stored. */
  unitName: string
  /** KV unit format version. */
  version: number
}

/** Schemastery configuration for the persistence provider. */
export const Config: z<Config> = z.object({
  backend: z.string().default('sqlite'),
  unitName: z.string().default('memory'),
  version: z.natural().default(1),
})

/**
 * Mount a durable store over the configured storage backend.
 * @param ctx - registrant context carrying `storage` and `memory`.
 * @param config - persistence configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const backend = ctx.storage.backend.get(config.backend)
  const kv = backend.kv
  if (kv === undefined) {
    throw new Error(`storage backend '${config.backend}' has no kv facet`)
  }
  const unit = await kv.open({
    name: config.unitName,
    version: config.version,
    tables: ['fingerprints', 'records'],
    hasGlobal: false,
  })
  const { tables } = await unit.loadAll()

  // Data written by this same package, so the shape is trusted at this durable
  // boundary; a cross-version migration would validate here instead.
  const fingerprints = new Map<string, ContradictionFingerprint>(
    Object.entries(tables.fingerprints ?? {}).map(([key, value]) => [key, value as ContradictionFingerprint]),
  )
  const records = new Map<string, MemoryRecord>(
    Object.entries(tables.records ?? {}).map(([key, value]) => [key, value as MemoryRecord]),
  )

  const store: MemoryStore = {
    listFingerprints: () => [...fingerprints.values()],
    saveFingerprint: (fingerprint) => {
      fingerprints.set(fingerprint.id, fingerprint)
      void unit.putRecord('fingerprints', fingerprint.id, fingerprint)
    },
    listRecords: () => [...records.values()].sort((a, b) => a.timestamp - b.timestamp),
    appendRecord: (record) => {
      records.set(record.id, record)
      void unit.putRecord('records', record.id, record)
    },
  }

  const unmount = ctx.memory.mountStore(store)
  ctx.effect(() => () => {
    unmount()
    void unit.close()
  })
}
