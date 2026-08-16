/**
 * Task-level three-state evaluator: observes the persistent `turn/end` session
 * event and records the turn's outcome (`success` / `failure` / `inconclusive`)
 * as a `task_outcome` record in `ctx.memory`. This supplies the Reflexion-style
 * "Evaluator" signal the rest of the self-evolution loop converges on: whether a
 * whole task succeeded, not merely whether one tool call errored.
 *
 * @module @deepseek-ai/dsh-task-evaluator
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: loads the `ctx.memory` augmentation.
import type {} from '@deepseek-ai/dsh-memory'
// Type-only: loads the `session/event` declaration and the `SessionEvent` types.
import type {} from '@deepseek-ai/dsh-session'

export const name = 'task-evaluator'
export const inject = ['memory']

/** The three-state task outcome; `inconclusive` is a legitimate terminal state. */
export type TaskOutcome = 'success' | 'failure' | 'inconclusive'

/**
 * Map a `turn/end` reason kind to a three-state outcome. Only a clean
 * `completed` turn is `success` and only an `error` turn is `failure`; every
 * other reason (`aborted`, `blocked`, `max-tokens`, `interrupted`, …) is
 * `inconclusive` and must never be forced into success or failure.
 * @param reasonKind - the `turn/end` `reason.kind`.
 * @returns the three-state outcome.
 */
export function classifyOutcome(reasonKind: string): TaskOutcome {
  if (reasonKind === 'completed') return 'success'
  if (reasonKind === 'error') return 'failure'
  return 'inconclusive'
}

/**
 * Observe `turn/end` and record each turn's outcome.
 * @param ctx - registrant context carrying `memory`.
 */
export function apply(ctx: Context): void {
  const memory = ctx.memory
  ctx.on('session/event', (_session, event) => {
    if (event.type !== 'turn/end') return
    const outcome = classifyOutcome(event.data.reason.kind)
    memory.record({
      type: 'task_outcome',
      payload: { outcome, turn: event.data.turn, reasonKind: event.data.reason.kind },
      tags: ['task_outcome', outcome],
    })
  })
}
