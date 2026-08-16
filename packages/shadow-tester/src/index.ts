/**
 * Shadow tester: pre-runs a high-risk self-modification in an isolated fork
 * before the main runtime applies it. `shadowTest` spawns a `fork` subagent
 * that evaluates the operation; a run that does not complete cleanly (or whose
 * child reports failure) is recorded as a `shadow_failure` negative sample in
 * `ctx.memory` so the agent can learn from the pre-flight failure without the
 * main operation ever executing.
 *
 * @module @deepseek-ai/dsh-shadow-tester
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import type { Memory } from '@deepseek-ai/dsh-memory'

declare module '@deepseek-ai/cordis' {
  interface Context {
    shadowTester: ShadowTester
  }
}

/** One self-modification operation to pre-flight. */
export interface ShadowTestOperation {
  /** The tool name that would perform the operation. */
  toolName: string
  /** Human-readable description of what the operation does. */
  description: string
}

/** The outcome of one shadow pre-flight. */
export interface ShadowTestResult {
  /** Whether the operation is safe to apply. */
  passed: boolean
  /** Human-readable warnings from the pre-flight (empty when passed). */
  warnings: string[]
}

/** Extract the plain-text body of a child's output blocks. */
function extractText(blocks: readonly { type: string; text?: string }[]): string {
  return blocks
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim()
}

/**
 * The shadow-testing service. Consumers reach it as `ctx.shadowTester`.
 */
export class ShadowTester extends Service {
  constructor(ctx: Context) {
    super(ctx, 'shadowTester')
  }

  /**
   * Pre-run one self-modification in an isolated fork and record a negative
   * sample on failure. The main operation is never executed here — this only
   * decides whether it is safe to apply.
   * @param operation - the operation to pre-flight.
   * @param parent - the agent authorizing the operation (the fork's parent).
   * @param signal - caller cancellation for the fork.
   * @returns the pre-flight outcome.
   */
  async shadowTest(operation: ShadowTestOperation, parent: Agent, signal: AbortSignal): Promise<ShadowTestResult> {
    const subagents = this.ctx.get('subagents') as SubagentRuntime | undefined
    const memory = this.ctx.get('memory') as Memory | undefined
    if (subagents === undefined) {
      return { passed: false, warnings: ['shadow testing requires the subagents service'] }
    }
    try {
      const run = await subagents.start('fork', {
        parent,
        label: `shadow-test:${operation.toolName}`,
        prompt: [{
          type: 'text',
          text: `你是一个影子试验沙箱。请评估以下自修改操作是否安全，并执行冒烟读写检测它是否引发状态突变。\n操作：${operation.toolName}\n描述：${operation.description}\n\n只回复 "PASS" 或 "FAIL: <原因>"。`,
        }],
        signal,
      })
      const result = await run.result
      await run.dispose()
      const text = extractText(result.output)
      const passed = result.stopReason === 'completed' && /PASS/i.test(text)
      if (!passed && memory !== undefined) {
        memory.record({ type: 'shadow_failure', payload: { operation, stopReason: result.stopReason, text }, tags: ['candidate_strategy', 'failed'] })
      }
      return { passed, warnings: passed ? [] : [text.length > 0 ? text : result.stopReason] }
    } catch (error) {
      if (memory !== undefined) {
        memory.record({ type: 'shadow_failure', payload: { operation, error: String(error) }, tags: ['candidate_strategy', 'failed'] })
      }
      return { passed: false, warnings: [String(error)] }
    }
  }
}

export default ShadowTester
