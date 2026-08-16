/**
 * Lesson injector: registers a `systemPrompt` section whose text reads the most
 * recent β/γ contradiction fingerprints from `ctx.memory` and renders them as a
 * forced-reflection block. The section text is evaluated at every prompt
 * assembly, so the model always sees the current "scars" without any loop change.
 *
 * @module @deepseek-ai/dsh-lesson-injector
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ContradictionType } from '@deepseek-ai/dsh-memory'
// Type-only: loads the `ctx.systemPrompt` augmentation.
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'lesson-injector'
export const inject = ['memory', 'systemPrompt']

/** Model-facing lesson-injection configuration. */
export interface Config {
  /** Section name; a deployment may shadow it per agent. */
  sectionName: string
  /** Section order; `300` renders after persona (0) and tool guidance (100–199). */
  order: number
  /** Maximum number of lessons to inject per assembly. */
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
 * Render the forced-reflection block for the current lesson set.
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
 * Register the lesson section. The text provider is synchronous and reads the
 * in-memory meta-memory store directly, so no async assembly is required.
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
}
