/**
 * Offline reflector: on a timer, batches unresolved γ contradictions, runs a
 * root-cause analysis through the LLM seam, and records the resulting patch
 * suggestion into `ctx.memory` before marking the fingerprints resolved.
 *
 * Actual application of a patch (editing configuration or re-running plugins)
 * is deliberately out of scope here — it belongs to the self-modification
 * tooling. This reflector owns only the "consolidate scars into a durable root
 * cause" step, which is the stage-4 offline consolidation of the pipeline.
 *
 * @module @deepseek-ai/dsh-offline-reflector
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { BlockAssembler, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { ContradictionFingerprint } from '@deepseek-ai/dsh-memory'
// Type-only: loads the `ctx.interval`/`ctx.timeout` timer mixin augmentation.
import type {} from '@deepseek-ai/cordis-plugin-timer'

export const name = 'offline-reflector'
export const inject = ['timer', 'memory', 'llm']

/** Model-facing offline-reflector configuration. */
export interface Config {
  /** Provider route for the root-cause analysis call. */
  provider: string
  /** Model id for the root-cause analysis call. */
  model: string
  /** Poll interval in milliseconds. */
  intervalMs: number
  /** Skip reflection until at least this many unresolved γ fingerprints accumulate. */
  minUnsolved: number
  /** Maximum fingerprints to batch into one analysis. */
  maxReflections: number
}

/** Schemastery configuration for the reflector. */
export const Config: z<Config> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  intervalMs: z.natural().default(60000),
  minUnsolved: z.natural().default(5),
  maxReflections: z.natural().default(20),
})

/** A parsed patch suggestion, as returned by the analysis model. */
export interface PatchSuggestion {
  rootCause: string
  suggestedActions: Array<{ type: string; target: string; payload?: unknown }>
}

/**
 * Build the root-cause analysis prompt.
 * @param lessons - the unresolved γ lessons to analyze.
 * @returns the model prompt.
 */
export function analysisPrompt(lessons: readonly ContradictionFingerprint[]): string {
  const lines = lessons.map(fingerprint => `- ${fingerprint.semanticLesson}`).join('\n')
  return `以下是 Agent 在最近运行时发生的 ${lessons.length} 次状态迁移撕裂矛盾：
${lines}

请分析这些矛盾的共同根因，只输出一个 JSON 对象（不要输出其他文字）：
{
  "rootCause": "string",
  "suggestedActions": [
    { "type": "config_update", "target": "memory_manager", "payload": {} }
  ]
}`
}

/**
 * Run one model call and accumulate its text deltas.
 * @param ctx - context carrying `llm`.
 * @param config - reflector configuration.
 * @param prompt - the prompt to send.
 * @returns the accumulated text.
 */
async function completeText(ctx: Context, config: Config, prompt: string): Promise<string> {
  const message = createUserMessage({
    content: [{ type: 'text', text: prompt }],
    source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-offline-reflector' },
  })
  const assembler = new BlockAssembler()
  const stream = ctx.llm.stream({
    provider: config.provider,
    model: config.model,
    messages: [message],
    maxTokens: 1024,
    reasoningEffort: ReasoningEffortId('off'),
  })
  for await (const chunk of stream) {
    assembler.push(chunk)
  }
  return assembler.blocks()
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join(' ')
    .trim()
}

/**
 * Analyze unresolved γ contradictions and consolidate them into a patch
 * suggestion. Best-effort: failures are recorded and never propagate.
 * @param ctx - context carrying `memory` and `llm`.
 * @param config - reflector configuration.
 */
async function reflect(ctx: Context, config: Config): Promise<void> {
  const unsolved = ctx.memory.queryUnsolvedContradictions('gamma', config.maxReflections)
  if (unsolved.length < config.minUnsolved) return
  let patch: PatchSuggestion
  try {
    const raw = await completeText(ctx, config, analysisPrompt(unsolved))
    patch = JSON.parse(raw) as PatchSuggestion
  } catch {
    ctx.memory.record({ type: 'patch_failure', payload: { reason: 'analysis-failed' }, tags: ['offline_reflector'] })
    return
  }
  for (const action of patch.suggestedActions ?? []) {
    ctx.memory.record({ type: 'evolution_patch', payload: { action, rootCause: patch.rootCause }, tags: ['offline_reflector'] })
  }
  for (const fingerprint of unsolved) {
    ctx.memory.markResolved(fingerprint.id, patch.rootCause)
  }
}

/**
 * Register the periodic reflection timer. A running reflection is never
 * overlapped; the timer's disposer is owned by the plugin fiber.
 * @param ctx - registrant context carrying `timer`, `memory`, and `llm`.
 * @param config - reflector configuration.
 */
export function apply(ctx: Context, config: Config): void {
  let running = false
  ctx.interval(() => {
    if (running) return
    running = true
    void reflect(ctx, config).finally(() => {
      running = false
    })
  }, config.intervalMs)
}
