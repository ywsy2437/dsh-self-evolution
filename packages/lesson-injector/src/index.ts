/**
 * Lesson injector: two complementary, passive read paths over `ctx.memory`.
 *
 * 1. A `systemPrompt` section renders the most recent β/γ contradiction
 *    fingerprints as a forced-reflection block, evaluated at every prompt
 *    assembly so the model always sees the current "scars" without any loop
 *    change.
 * 2. An `agent/pre-step` hook ranks the fingerprints by keyword relevance to
 *    the claimed messages and prepends a `【相关记忆】` block, so task-specific
 *    lessons surface automatically — the model never has to opt in by calling
 *    `memory_query`.
 *
 * @module @deepseek-ai/dsh-lesson-injector
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ContradictionType } from '@deepseek-ai/dsh-memory'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm'
// Type-only: loads the `ctx.systemPrompt` augmentation.
import type {} from '@deepseek-ai/dsh-system-prompt'
// Type-only: loads the `agent/pre-step` event augmentation.
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'

export const name = 'lesson-injector'
export const inject = ['memory', 'systemPrompt']

/** Model-facing lesson-injection configuration. */
export interface Config {
  /** Section name; a deployment may shadow it per agent. */
  sectionName: string
  /** Section order; `300` renders after persona (0) and tool guidance (100–199). */
  order: number
  /** Maximum number of lessons to inject per assembly or per relevant step. */
  maxLessons: number
  /** Lowest contradiction severity to inject. */
  minSeverity: ContradictionType
}

/** Schemastery configuration for the lesson injector. */
export const Config: z<Config> = z.object({
  sectionName: z.string().default('self-evolution:lessons'),
  order: z.number().default(300),
  maxLessons: z.natural().default(3),
  minSeverity: z.union([z.const('alpha' as const), z.const('beta' as const), z.const('gamma' as const)]).default('beta' as const),
})

/**
 * Render the recency-ranked forced-reflection block for the current lesson set.
 * @param lessons - the fingerprints to surface.
 * @returns the model-facing text, or `''` when there is nothing to inject.
 */
export function renderLessons(lessons: readonly { semanticLesson: string; occurrenceCount: number }[]): string {
  if (lessons.length === 0) return ''
  const lines = lessons
    .map((lesson, index) => `[教训${index + 1}] ${lesson.semanticLesson} (发生次数: ${lesson.occurrenceCount})`)
    .join('\n')
  return `【系统强制反思】你最近的 ${lessons.length} 次自修改操作引发了运行时矛盾：\n${lines}\n请在本次推理中明确调整你的策略，避免重复错误。`
}

/**
 * Render the relevance-retrieved block. Unlike the recency section, this block
 * names the task relevance so the model knows why these lessons surface now.
 * @param lessons - the relevance-ranked fingerprints.
 * @returns the model-facing text.
 */
export function renderRelevantLessons(lessons: readonly { semanticLesson: string; occurrenceCount: number }[]): string {
  const lines = lessons
    .map((lesson, index) => `[教训${index + 1}] ${lesson.semanticLesson} (发生次数: ${lesson.occurrenceCount})`)
    .join('\n')
  return `【相关记忆】以下经验教训与你当前的任务高度相关，请据此规避过往错误：\n${lines}`
}

/**
 * Extract the model-facing text from claimed messages, recursing into tool
 * results so later steps (whose claimed batch is mostly tool output) still
 * yield a relevance query.
 * @param messages - the claimed user messages.
 * @returns the concatenated text, `''` when there is none.
 */
function extractText(messages: readonly UserMessage[]): string {
  const parts: string[] = []
  const collect = (blocks: readonly ContentBlock[]): void => {
    for (const block of blocks) {
      if (block.type === 'text' || block.type === 'reasoning') parts.push(block.text)
      else if (block.type === 'tool-result') collect(block.content)
    }
  }
  for (const message of messages) collect(message.content)
  return parts.join('\n')
}

/**
 * Register the recency section and the relevance-based passive pre-step hook.
 * @param ctx - registrant context carrying `memory` and `systemPrompt`.
 * @param config - deployment's injection policy.
 */
export function apply(ctx: Context, config: Config): void {
  const memory = ctx.memory
  ctx.systemPrompt.section({
    name: config.sectionName,
    order: config.order,
    text: () => renderLessons(memory.queryRecentContradictions(config.maxLessons, config.minSeverity)),
  })

  // Passive relevance injection: delegate first (so a downstream listener can
  // still reject or rewrite), then prepend task-specific lessons only when the
  // step proceeds and relevant lessons exist.
  ctx.on('agent/pre-step', async ({ messages, signal }, next): Promise<PreStepDecision> => {
    const text = extractText(messages)
    if (text.length === 0) return next()
    const lessons = memory.queryRelevantContradictions(text, config.maxLessons, config.minSeverity)
    if (lessons.length === 0) return next()
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted) return decision
    const rendered = renderRelevantLessons(lessons)
    const context = createUserMessage({
      content: [{ type: 'text', text: rendered }],
      source: { kind: 'plugin', plugin: name, form: 'snapshot', sections: [{ name, text: rendered }] },
    })
    return { kind: 'enter', messages: [context, ...decision.messages] }
  })
}
