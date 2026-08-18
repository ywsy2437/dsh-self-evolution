/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-heartbeat`.
 * @module @deepseek-ai/dsh-heartbeat/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
// Type-only: loads the `ctx.memory` augmentation.
import type {} from '@deepseek-ai/dsh-memory'
import type { HeartbeatIdea } from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-heartbeat'

/** Cordis companion plugin name. */
export const name = 'heartbeat-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Owned relationship: every published `heartbeat/idea` must already be
 * recorded in `ctx.memory` (the plugin records the thought before it emits),
 * so an idea reaching a channel without a matching memory record proves a
 * write path bypassed the memory hub.
 */
const install: InvariantInstaller = Object.assign(
  (ctx: Context, fail: (message: string) => never) => {
    ctx.on('heartbeat/idea', (idea: HeartbeatIdea) => {
      const recorded = ctx.memory.listRecords().some(record =>
        record.type === 'thought'
        && record.tags.includes('heartbeat')
        && (record.payload as { content?: unknown } | null)?.content === idea.content)
      if (!recorded) {
        fail('heartbeat/idea emitted without a matching thought record in memory')
      }
    })
  },
  { inject: ['memory'] },
)

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
