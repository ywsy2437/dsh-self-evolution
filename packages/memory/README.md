# @deepseek-ai/dsh-memory

English | [中文](README.zh.md)

Meta-memory hub (`ctx.memory`) for the self-evolution capability: a contradiction-fingerprint store plus generic meta-memory records. A repeat of the same `(type, triggerOp)` contradiction folds into one fingerprint (incrementing its occurrence count) rather than accumulating duplicates. The default store is in-memory; a durable provider mounts a `MemoryStore` via `mountStore()`.

## Shape

- `recordFingerprint(input)` — fold a new contradiction into its fingerprint, returning the stored fingerprint.
- `queryRecentContradictions(limit, minSeverity)` — recent fingerprints at or above a severity, most recent first.
- `queryUnsolvedContradictions(minSeverity, limit)` — unresolved fingerprints for offline reflection.
- `markResolved(id, resolvedBy)` — mark a fingerprint resolved by a patch.
- `record(input)` / `listRecords()` — generic meta-memory records (shadow failures, patches, patch failures).
- `mountStore(store)` — swap in a durable `MemoryStore`; the returned disposer restores the previous store.

Reads are synchronous because the primary consumer is a `systemPrompt` section provider.

## Model Experience

### Fingerprint reads and writes

#### What the model sees

Nothing directly. `ctx.memory` is a host-side store; it registers no tool and injects no prompt. Other self-evolution packages surface its fingerprints (the lesson injector) or expose a query tool (`memory_query`).

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests: the store never touches a request prefix, so it cannot invalidate provider cache reuse.

## Known Limitations and Deferred Work

- **In-memory by default** — fingerprints are process/scoped; persistence requires `dsh-memory-sqlite`.
- **Fingerprint ids are process-local** — the id generator does not depend on a platform crypto global.
