/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-contradiction-semanticizer`.
 * @module @deepseek-ai/dsh-contradiction-semanticizer/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-contradiction-semanticizer'

/** Cordis companion plugin name. */
export const name = 'contradiction-semanticizer-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the semanticizer is a best-effort observer that writes
 * into `memory` (whose consistency the memory package owns); it owns no event
 * stream or mutable medium of its own to cross-check.
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
