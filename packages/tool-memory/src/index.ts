/**
 * Model-facing `memory_query` tool: reads the self-evolution meta-memory store
 * (contradiction lessons and evolution records) so the agent can inspect its own
 * accumulated "scars" on demand. When a `query` is supplied, results are ranked
 * by keyword relevance (Reflexion/SAGE retrieval) instead of recency alone.
 *
 * @module @deepseek-ai/dsh-tool-memory
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContradictionType } from '@deepseek-ai/dsh-memory'

export const name = 'tool-memory'
export const inject = ['tools', 'memory']

/** Model-facing memory tool configuration. */
export interface Config {
  /** Default result cap when the model omits `limit`. */
  maxResults: number
}

/** Schemastery configuration for the memory tool. */
export const Config: z<Config> = z.object({
  maxResults: z.natural().default(10),
})

/** Pool size fetched before relevance ranking (so ranking is not starved by recency). */
const RELEVANCE_POOL = 100

/**
 * Tokenize text into lowercase ASCII words plus individual CJK characters.
 * CJK has no word boundaries, so each character is a retrieval unit.
 * @param text - the text to tokenize.
 * @returns the token set.
 */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  const lower = text.toLowerCase()
  for (const match of lower.matchAll(/[a-z0-9]+/g)) {
    tokens.add(match[0])
  }
  for (const char of lower) {
    if (/[\u4e00-\u9fff]/.test(char)) tokens.add(char)
  }
  return tokens
}

/**
 * Keyword-overlap relevance: the fraction of query tokens present in the text.
 * Zero when the query has no tokens.
 * @param query - the task description / search text.
 * @param text - the candidate text (lesson, record, …).
 * @returns a score in `[0, 1]`.
 */
export function relevanceScore(query: string, text: string): number {
  const q = tokenize(query)
  if (q.size === 0) return 0
  const t = tokenize(text)
  let overlap = 0
  for (const token of q) {
    if (t.has(token)) overlap += 1
  }
  return overlap / q.size
}

/**
 * Format one contradiction fingerprint as a single model-facing line.
 * @param fingerprint - the stored fingerprint.
 * @returns the summary line.
 */
export function formatFingerprint(fingerprint: {
  type: string
  triggerOp: string
  semanticLesson: string
  occurrenceCount: number
  resolvedBy?: string
}): string {
  const status = fingerprint.resolvedBy === undefined ? '未解决' : `已解决(${fingerprint.resolvedBy})`
  return `[${fingerprint.type}] ${fingerprint.triggerOp} (x${fingerprint.occurrenceCount}, ${status}): ${fingerprint.semanticLesson}`
}

/** Format one record as a single model-facing line. */
function formatRecord(record: { type: string; tags: string[]; timestamp: number; payload: unknown }): string {
  return `[${record.type}] ${record.tags.join(',')} @${record.timestamp}: ${JSON.stringify(record.payload)}`
}

/**
 * Register the `memory_query` tool.
 * @param ctx - registrant context carrying `tools` and `memory`.
 * @param config - deployment's result cap.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.tools.register(defineTool({
    name: 'memory_query',
    description:
      'Query the meta-memory: the contradiction lessons and evolution records this agent has accumulated. '
      + 'Pass `query` (a task description) to rank results by relevance instead of recency.',
    parameters: {
      kind: {
        type: 'string',
        required: true,
        enum: ['contradictions', 'records'],
        description: 'contradictions = distilled causal lessons; records = evolution events (patches, shadow failures, task outcomes, successes).',
      },
      minSeverity: {
        type: 'string',
        enum: ['alpha', 'beta', 'gamma'],
        description: 'For contradictions, the lowest severity to include.',
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of entries to return.',
      },
      query: {
        type: 'string',
        description: 'Optional task description; when provided, entries are ranked by keyword relevance to it.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          entries: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `memory_query returned ${value.entries.length} entries.` }],
    },
    execute(args) {
      const limit = args.limit ?? config.maxResults
      const query = args.query ?? ''
      if (args.kind === 'contradictions') {
        const severity = (args.minSeverity ?? 'alpha') as ContradictionType
        const pool = ctx.memory.queryRecentContradictions(RELEVANCE_POOL, severity)
        const ranked = query.length === 0
          ? pool
          : pool
            .map(f => ({ f, score: relevanceScore(query, `${f.triggerOp} ${f.semanticLesson}`) }))
            .sort((a, b) => b.score - a.score || b.f.lastOccurrence - a.f.lastOccurrence)
            .map(x => x.f)
        return Promise.resolve({ entries: ranked.slice(0, limit).map(formatFingerprint) })
      }
      const pool = ctx.memory.listRecords()
      const ranked = query.length === 0
        ? [...pool].reverse()
        : pool
          .map(r => ({ r, score: relevanceScore(query, `${r.type} ${r.tags.join(' ')} ${JSON.stringify(r.payload)}`) }))
          .sort((a, b) => b.score - a.score || b.r.timestamp - a.r.timestamp)
          .map(x => x.r)
      return Promise.resolve({ entries: ranked.slice(0, limit).map(formatRecord) })
    },
    presentCall: args => ({ card: 'generic', title: 'Query memory', kind: 'other', rawInput: args }),
  }))
}
