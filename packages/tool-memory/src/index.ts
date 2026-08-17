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
import { relevanceScore } from '@deepseek-ai/dsh-memory'
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
        const ranked = query.length === 0
          ? ctx.memory.queryRecentContradictions(limit, severity)
          : ctx.memory.queryRelevantContradictions(query, limit, severity)
        return Promise.resolve({ entries: ranked.map(formatFingerprint) })
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
