/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-lesson-injector`.
 * @module @deepseek-ai/dsh-lesson-injector/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-lesson-injector'

/** Cordis companion plugin name. */
export const name = 'lesson-injector-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the injector owns pure read-side projections (memory
 * fingerprints → prompt-section text and → pre-step context messages) with no
 * event stream or mutable medium of its own to cross-check; the memory service
 * already owns the source data's consistency.
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
