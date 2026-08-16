/**
 * Meta-memory hub (`ctx.memory`): the durable "scar" store of the self-evolution
 * capability. It keeps contradiction fingerprints (distilled causal lessons) and
 * generic meta-memory records. The hub holds an in-memory store by default; a
 * persistence provider mounts a durable {@link MemoryStore} with {@link Memory.mountStore}.
 *
 * Reads are synchronous because the primary consumer is a `systemPrompt` section
 * provider, whose text is evaluated synchronously during every prompt assembly.
 *
 * Registrations are effects: a mounted store is removed when its disposer runs or
 * the owning fiber unloads.
 *
 * @module @deepseek-ai/dsh-memory
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {
  ContradictionFingerprint,
  ContradictionType,
  FingerprintId,
  MemoryRecord,
  NewFingerprint,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    memory: Memory
  }
}

/**
 * Severity rank; `minSeverity` filters everything at or above it. A switch,
 * not an indexed record, so `noUncheckedIndexedAccess` needs no non-null
 * assertion and the ordering is exhaustively checked.
 * @param type - the contradiction severity.
 * @returns its ordinal rank.
 */
function severityRank(type: ContradictionType): number {
  switch (type) {
    case 'alpha': return 0
    case 'beta': return 1
    case 'gamma': return 2
  }
}

/** Process-local id counter; uniqueness within the process is the whole contract. */
let idSeq = 0

/** Generate a stable, process-unique id without a platform crypto dependency. */
function nextId(): string {
  idSeq += 1
  return `${Date.now().toString(36)}-${idSeq.toString(36)}`
}

/**
 * Storage backend for fingerprints and records. The default is in-memory; a
 * persistent provider swaps in a durable implementation.
 */
export interface MemoryStore {
  /** All fingerprints, unordered. */
  listFingerprints(): ContradictionFingerprint[]
  /** Insert or replace one fingerprint. */
  saveFingerprint(fingerprint: ContradictionFingerprint): void
  /** All records, ordered by timestamp ascending. */
  listRecords(): MemoryRecord[]
  /** Append one record. */
  appendRecord(record: MemoryRecord): void
}

/** Process-local store: data survives for the lifetime of the service instance. */
class InMemoryStore implements MemoryStore {
  private readonly fingerprints = new Map<FingerprintId, ContradictionFingerprint>()
  private readonly records: MemoryRecord[] = []

  listFingerprints(): ContradictionFingerprint[] {
    return [...this.fingerprints.values()]
  }

  saveFingerprint(fingerprint: ContradictionFingerprint): void {
    this.fingerprints.set(fingerprint.id, fingerprint)
  }

  listRecords(): MemoryRecord[] {
    return [...this.records]
  }

  appendRecord(record: MemoryRecord): void {
    this.records.push(record)
  }
}

/**
 * The meta-memory service. One instance per host composition; consumers reach it
 * as `ctx.memory` (or `ctx.get('memory')`). Keyed by fingerprint id, not by
 * session, so the same "scar" is visible to every session of the running
 * instance — matching the goal of instance-level, cross-session learning.
 */
export class Memory extends Service {
  private store: MemoryStore = new InMemoryStore()

  constructor(ctx: Context) {
    super(ctx, 'memory')
  }

  /**
   * Swap in a persistence store. Mounting is an effect: the returned disposer
   * restores the previous store.
   * @param store - the durable store to use.
   * @returns a disposer that unmounts the store.
   */
  mountStore(store: MemoryStore): () => void {
    const previous = this.store
    this.store = store
    return () => {
      if (this.store === store) {
        this.store = previous
      }
    }
  }

  /**
   * Record a contradiction. A repeat of the same `(type, triggerOp)` folds into
   * the existing fingerprint (incrementing its occurrence counter) instead of
   * creating a duplicate, so repeated failures accumulate weight rather than noise.
   * @param input - the distilled contradiction, without store-assigned fields.
   * @returns the stored fingerprint.
   */
  recordFingerprint(input: NewFingerprint): ContradictionFingerprint {
    const now = Date.now()
    const existing = this.store.listFingerprints().find(fp =>
      fp.type === input.type && fp.triggerOp === input.triggerOp && fp.resolvedBy === undefined)
    if (existing !== undefined) {
      existing.occurrenceCount += 1
      existing.lastOccurrence = now
      existing.semanticLesson = input.semanticLesson
      existing.causalChain = input.causalChain
      this.store.saveFingerprint(existing)
      return existing
    }
    const fingerprint: ContradictionFingerprint = {
      id: nextId() as FingerprintId,
      type: input.type,
      triggerOp: input.triggerOp,
      semanticLesson: input.semanticLesson,
      causalChain: input.causalChain,
      occurrenceCount: 1,
      lastOccurrence: now,
    }
    this.store.saveFingerprint(fingerprint)
    return fingerprint
  }

  /**
   * Recent contradictions at or above `minSeverity`, most recent first.
   * @param limit - maximum count.
   * @param minSeverity - lowest severity to include.
   * @returns the matching fingerprints.
   */
  queryRecentContradictions(limit: number, minSeverity: ContradictionType): ContradictionFingerprint[] {
    const floor = severityRank(minSeverity)
    return this.store.listFingerprints()
      .filter(fp => severityRank(fp.type) >= floor)
      .sort((a, b) => b.lastOccurrence - a.lastOccurrence)
      .slice(0, limit)
  }

  /**
   * Unresolved contradictions at or above `minSeverity` (for offline reflection).
   * @param minSeverity - lowest severity to include.
   * @param limit - maximum count.
   * @returns the matching fingerprints.
   */
  queryUnsolvedContradictions(minSeverity: ContradictionType, limit: number): ContradictionFingerprint[] {
    const floor = severityRank(minSeverity)
    return this.store.listFingerprints()
      .filter(fp => fp.resolvedBy === undefined && severityRank(fp.type) >= floor)
      .sort((a, b) => b.lastOccurrence - a.lastOccurrence)
      .slice(0, limit)
  }

  /**
   * Mark a fingerprint resolved by a patch.
   * @param id - the fingerprint id.
   * @param resolvedBy - the patch/action id that resolved it.
   */
  markResolved(id: FingerprintId, resolvedBy: string): void {
    const fingerprint = this.store.listFingerprints().find(fp => fp.id === id)
    if (fingerprint === undefined) return
    fingerprint.resolvedBy = resolvedBy
    this.store.saveFingerprint(fingerprint)
  }

  /**
   * Append a generic meta-memory record (shadow failures, patches, patch failures).
   * @param input - the record, without store-assigned fields.
   * @returns the stored record.
   */
  record(input: Omit<MemoryRecord, 'id' | 'timestamp'>): MemoryRecord {
    const record: MemoryRecord = {
      id: nextId(),
      type: input.type,
      payload: input.payload,
      tags: input.tags,
      timestamp: Date.now(),
    }
    this.store.appendRecord(record)
    return record
  }

  /** All records, ascending by timestamp. */
  listRecords(): MemoryRecord[] {
    return this.store.listRecords()
  }
}

// Service packages default-export their service class and nothing else
// plugin-shaped (packages/AGENTS.md).
export default Memory
