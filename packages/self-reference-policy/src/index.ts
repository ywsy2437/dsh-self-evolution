/**
 * Self-reference policy: gates self-referential tool calls (by default, tool
 * names starting with `cordis`) through the `tools/pre-execute` waterfall with
 * three levels: `requireApproval` (L3) turns into an approval request (`ask`);
 * `shadowTestTools` (L2) are pre-flighted through `ctx.shadowTester` in an
 * isolated fork before dispatch; everything else (L1) delegates (`next()`).
 * With both lists empty the policy is a no-op, so disabling it restores native
 * behavior.
 *
 * @module @deepseek-ai/dsh-self-reference-policy
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'

export const name = 'self-reference-policy'
export const inject = ['tools']

/** Model-facing self-reference policy configuration. */
export interface Config {
  /** Tool-name prefix that marks a call as self-referential. */
  selfReferencePrefix: string
  /** L3: self-referential tool names that require approval before dispatch. */
  requireApproval: string[]
  /** L2: self-referential tool names pre-flighted through the shadow tester. */
  shadowTestTools: string[]
}

/** Schemastery configuration for the policy. */
export const Config: z<Config> = z.object({
  selfReferencePrefix: z.string().default('cordis'),
  requireApproval: z.array(z.string()).default([]),
  shadowTestTools: z.array(z.string()).default([]),
})

/** Structural view of the optional shadow tester, avoiding a hard dependency. */
interface ShadowTesterLike {
  shadowTest(
    operation: { toolName: string; description: string },
    parent: Agent,
    signal: AbortSignal,
  ): Promise<{ passed: boolean; warnings: string[] }>
}

/** The gating decision for one tool name. */
export type PolicyDecision = 'allow' | 'ask'

/**
 * Decide whether a tool call is self-referential and, if so, whether it
 * requires approval. Pure and total: `null` means "not self-referential".
 * @param toolName - the tool name.
 * @param selfReferencePrefix - the prefix that marks self-referential calls.
 * @param requireApproval - self-referential names that require approval.
 * @returns `ask`, `allow`, or `null` for non-self-referential calls.
 */
export function decide(toolName: string, selfReferencePrefix: string, requireApproval: readonly string[]): PolicyDecision | null {
  if (!toolName.startsWith(selfReferencePrefix)) return null
  if (requireApproval.includes(toolName)) return 'ask'
  return 'allow'
}

/**
 * Map a shadow pre-flight outcome to a gate decision. `null` means "delegate"
 * (allow); a failed or unavailable pre-flight denies or asks instead.
 * @param toolName - the tool being gated.
 * @param result - the pre-flight outcome, or `undefined` when it could not run.
 * @returns the decision, or `null` to allow.
 */
export function shadowGateDecision(toolName: string, result: { passed: boolean; warnings: string[] } | undefined): PreToolDecision | null {
  if (result === undefined) {
    return { kind: 'ask', reason: `self-referential operation "${toolName}" requires a shadow pre-flight (unavailable)` }
  }
  if (!result.passed) {
    return { kind: 'deny', reason: `shadow pre-flight failed for "${toolName}": ${result.warnings.join('; ')}` }
  }
  return null
}

/**
 * Register the pre-execute gate.
 * @param ctx - registrant context carrying `tools`.
 * @param config - deployment's gating policy.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!exec.name.startsWith(config.selfReferencePrefix)) return next()
    if (config.requireApproval.includes(exec.name)) {
      return { kind: 'ask', reason: `self-referential operation "${exec.name}" requires approval` }
    }
    if (config.shadowTestTools.includes(exec.name)) {
      const shadowTester = ctx.get('shadowTester') as ShadowTesterLike | undefined
      const result = shadowTester === undefined || exec.agent === undefined
        ? undefined
        : await shadowTester.shadowTest(
          { toolName: exec.name, description: `self-referential operation ${exec.name}` },
          exec.agent,
          exec.signal,
        )
      const decision = shadowGateDecision(exec.name, result)
      if (decision !== null) return decision
      return next()
    }
    return next()
  })
}
