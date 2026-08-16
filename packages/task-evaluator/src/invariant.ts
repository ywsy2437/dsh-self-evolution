/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-task-evaluator`.
 * @module @deepseek-ai/dsh-task-evaluator/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-task-evaluator'

/** Cordis companion plugin name. */
export const name = 'task-evaluator-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the evaluator is a read-only observer that writes
 * `task_outcome` records into `memory` (whose consistency the memory package
 * owns); it owns no event stream or mutable medium of its own to cross-check.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
