/**
 * Contradiction semanticizer: observes `tools/result` failures of
 * self-referential tools, distills each failure into a natural-language causal
 * lesson through the LLM seam, and records it as a {@link ContradictionFingerprint}
 * in `ctx.memory`. Distillation is best-effort: a failure never breaks the tool
 * pipeline it observes.
 *
 * @module @deepseek-ai/dsh-contradiction-semanticizer
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { BlockAssembler, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { ContradictionType, Memory } from '@deepseek-ai/dsh-memory'
// Type-only: loads the `ctx.llm` augmentation and the `tools/result` event declaration.
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'contradiction-semanticizer'
export const inject = ['memory', 'llm']

/** Model-facing semanticizer configuration. */
export interface Config {
  /** Provider route for the auxiliary distillation call. */
  provider: string
  /** Model id for the auxiliary distillation call. */
  model: string
  /** Upper bound on the distilled lesson's word count. */
  maxLessonWords: number
  /** Only failures of tools whose name starts with this prefix are distilled. */
  selfReferenceToolPrefix: string
  /** Also record a lightweight `success` record for successful self-referential calls. */
  recordSuccess: boolean
}

/** Schemastery configuration for the semanticizer. */
export const Config: z<Config> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  maxLessonWords: z.natural().default(50),
  selfReferenceToolPrefix: z.string().default('cordis'),
  recordSuccess: z.boolean().default(true),
})

/**
 * Classify a contradiction severity from the operation and error text. Data or
 * migration failures are `gamma` (migration tear); everything else is `beta`
 * (semantic drift). `alpha` (silent, low-value) is intentionally never
 * distilled.
 * @param toolName - the failing tool name.
 * @param errorMessage - the normalized failure message.
 * @returns the severity class.
 */
export function classifyContradiction(toolName: string, errorMessage: string): ContradictionType {
  if (/migrat|data|schema/i.test(toolName) || /migrat|data|schema/i.test(errorMessage)) return 'gamma'
  return 'beta'
}

/**
 * Build the distillation prompt.
 * @param toolName - the failing operation.
 * @param errorMessage - the normalized failure message.
 * @param maxWords - lesson word bound.
 * @returns the model prompt.
 */
export function distillationPrompt(toolName: string, errorMessage: string, maxWords: number): string {
  return `你是一个 Agent 进化教练。以下是一次 Agent 修改自身运行时组件时发生的运行时矛盾：
操作：${toolName}
错误：${errorMessage}

请用一段不超过 ${maxWords} 个字的中文，总结出 Agent 应该吸取的"因果教训"。
格式："因为 [原因]，导致 [后果]，下次应该 [行动]"（只输出教训本身）`
}

/**
 * Distill one failure into a lesson via the LLM seam. Uses the captured service
 * instance (not `ctx`) so a fire-and-forget distillation survives context disposal.
 * @param llm - the LLM service instance.
 * @param config - distillation configuration.
 * @param toolName - the failing operation.
 * @param errorMessage - the normalized failure message.
 * @returns the distilled lesson, or `''` when the model returned nothing usable.
 */
async function distillLesson(llm: LlmRuntime, config: Config, toolName: string, errorMessage: string): Promise<string> {
  const message = createUserMessage({
    content: [{ type: 'text', text: distillationPrompt(toolName, errorMessage, config.maxLessonWords) }],
    source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-contradiction-semanticizer' },
  })
  const assembler = new BlockAssembler()
  const stream = llm.stream({
    provider: config.provider,
    model: config.model,
    messages: [message],
    maxTokens: 256,
    // Distillation is a small auxiliary call; reasoning adds latency without value.
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
 * Observe a failed self-referential tool call, distill it, and record the lesson.
 * @param memory - the memory service instance.
 * @param llm - the LLM service instance.
 * @param config - distillation configuration.
 * @param toolName - the failing tool name.
 * @param errorMessage - the normalized failure message.
 */
async function distillAndRecord(memory: Memory, llm: LlmRuntime, config: Config, toolName: string, errorMessage: string): Promise<void> {
  // A fingerprint is ALWAYS recorded, even when distillation itself fails: the
  // failure is the thing to remember, and a silent gap would defeat the whole
  // "remember failure" loop.
  const fallback = `因为 ${toolName} 执行失败（${errorMessage.slice(0, 120)}），导致自修改未生效，下次应先检查再提交。`
  let lesson = fallback
  try {
    const distilled = await distillLesson(llm, config, toolName, errorMessage)
    if (distilled.length > 0) lesson = distilled
  } catch {
    // Keep the fallback lesson.
  }
  memory.recordFingerprint({
    type: classifyContradiction(toolName, errorMessage),
    triggerOp: toolName,
    semanticLesson: lesson,
    causalChain: ['self-modification', toolName, 'contradiction'],
  })
}

/**
 * Listen for self-referential tool failures and record distilled lessons.
 * @param ctx - registrant context carrying `memory` and `llm`.
 * @param config - distillation configuration.
 */
export function apply(ctx: Context, config: Config): void {
  // Capture the service instances up front: the listener's fire-and-forget
  // distillation resumes after the tool pipeline returns, possibly after this
  // context is disposed, so it must not re-read `ctx.memory`/`ctx.llm`.
  const memory = ctx.memory
  const llm = ctx.llm
  ctx.on('tools/result', (exec, result) => {
    if (!exec.name.startsWith(config.selfReferenceToolPrefix)) return
    if (result.isError) {
      void distillAndRecord(memory, llm, config, exec.name, result.error.message)
    } else if (config.recordSuccess) {
      // Success library (Voyager): remember what worked, not only what broke.
      // A success pattern MUST carry `failureConditions` (when NOT to reuse it),
      // otherwise it degrades into an overfitted template.
      memory.record({
        type: 'success',
        payload: {
          toolName: exec.name,
          failureConditions: '若目标与本次成功操作不同（pluginId/packageId/参数/上下文不一致），勿复用此成功模式',
        },
        tags: ['success'],
      })
    }
  })
}
