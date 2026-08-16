# @deepseek-ai/dsh-offline-reflector

English | [中文](README.zh.md)

On a timer, batches unresolved γ contradictions from `ctx.memory`, runs a root-cause analysis through the LLM seam, records the resulting patch suggestion as `evolution_patch` records, and marks the fingerprints resolved. It owns the "consolidate scars into a durable root cause" step; applying a patch is the self-modification tooling's job.

## Shape

- `provider` / `model` — route for the root-cause analysis call (required).
- `intervalMs` — poll interval (default 60000).
- `minUnsolved` — skip until at least this many unresolved γ fingerprints accumulate (default 5).
- `maxReflections` — maximum fingerprints per analysis (default 20).

## Model Experience

### Root-cause analysis calls

#### What the model sees

Nothing directly on the main request. Each analysis is one auxiliary model call whose patch suggestion lands in `ctx.memory`.

#### Token effect

Zero tokens on the main request; one auxiliary call capped at `maxTokens: 1024` per analysis batch.

#### KV Cache effect

Auxiliary calls are separate requests and do not touch the conversation prefix.

## Known Limitations and Deferred Work

- **Suggestions, not applications** — the reflector records patch suggestions and marks fingerprints resolved but does not apply configuration changes or reload plugins.
- **Periodic, not idle-gated** — reflection runs on a timer rather than only while the instance is idle.
