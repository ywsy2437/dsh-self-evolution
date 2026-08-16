/**
 * Pure types of the meta-memory domain. Types only — no runtime code; the
 * service implementation lives in `./index.ts`.
 *
 * @module @deepseek-ai/dsh-memory/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** A contradiction-fingerprint id, branded so it cannot be confused with other string ids. */
export type FingerprintId = Branded<'dsh-memory/fingerprint-id'>

/** Severity of a self-reference contradiction, by evolutionary value. */
export type ContradictionType = 'alpha' | 'beta' | 'gamma'

/**
 * One distilled self-reference contradiction: the durable "scar" the agent
 * remembers. `semanticLesson` is the LLM-translated natural-language causal
 * lesson (the model-visible payload); the rest is retrieval metadata.
 */
export interface ContradictionFingerprint {
  /** Stable id of this fingerprint (or of the earliest occurrence it folds). */
  id: FingerprintId
  /** Severity class: `alpha` (silent rollback) < `beta` (semantic drift) < `gamma` (data tear). */
  type: ContradictionType
  /** Human-readable description of the meta-operation that triggered it. */
  triggerOp: string
  /** The distilled ≤50-word causal lesson. */
  semanticLesson: string
  /** Trigger chain: operation → state → contradiction. */
  causalChain: string[]
  /** How many times the same (type, triggerOp) contradiction has occurred. */
  occurrenceCount: number
  /** Epoch milliseconds of the most recent occurrence. */
  lastOccurrence: number
  /** Patch id that resolved it, when offline reflection has fixed the root cause. */
  resolvedBy?: string
}

/** A generic meta-memory event record (shadow failures, patches, patch failures). */
export interface MemoryRecord {
  /** Stable record id. */
  id: string
  /** Record kind: `shadow_failure`, `evolution_patch`, `patch_failure`, … */
  type: string
  /** JSON-safe payload owned by the recorder. */
  payload: unknown
  /** Retrieval tags. */
  tags: string[]
  /** Epoch milliseconds of the record. */
  timestamp: number
}

/** The shape of a fingerprint before the store assigns id and occurrence counters. */
export interface NewFingerprint {
  type: ContradictionType
  triggerOp: string
  semanticLesson: string
  causalChain: string[]
}
