# @deepseek-ai/dsh-contradiction-semanticizer

English | [中文](README.zh.md)

Observes `tools/result` failures of self-referential tools (name prefix `cordis` by default), distills each failure into a natural-language causal lesson through the LLM seam, and records it as a `ContradictionFingerprint` in `ctx.memory`. Distillation is best-effort and always records a fingerprint (a fallback lesson when the model call fails).

## Shape

- `provider` / `model` — route for the auxiliary distillation call (required).
- `maxLessonWords` — upper bound on the lesson word count (default 50).
- `selfReferenceToolPrefix` — tool-name prefix marking self-referential calls (default `cordis`).

## Model Experience

### Distillation calls

#### What the model sees

Nothing directly on the main request. Each failed self-referential tool triggers one auxiliary model call (the distillation), whose lesson lands in `ctx.memory` and is later surfaced by the lesson injector.

#### Token effect

Zero tokens on the main request; one auxiliary call capped at `maxTokens: 256` per failure.

#### KV Cache effect

Auxiliary calls are separate requests and do not touch the conversation prefix.

## Known Limitations and Deferred Work

- **α/β/γ classification is heuristic** — `gamma` for migrate/data/schema failures, otherwise `beta`; silent `alpha` contradictions are not distilled.
- **Provider/model are required** — a deployment must route the auxiliary call explicitly (misconfiguration fails loud).
