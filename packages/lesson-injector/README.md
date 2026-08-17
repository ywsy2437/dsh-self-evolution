# @deepseek-ai/dsh-lesson-injector

English | [中文](README.zh.md)

Two complementary, passive read paths over `ctx.memory`, so the model leverages its own "scars" without ever having to opt in:

1. A `systemPrompt` section renders the most recent β/γ contradiction fingerprints as a forced-reflection block, evaluated at every prompt assembly.
2. An `agent/pre-step` hook ranks fingerprints by keyword relevance to the claimed messages and prepends a `【相关记忆】` block, surfacing task-specific lessons automatically.

## Shape

- `sectionName` — section name (default `self-evolution:lessons`).
- `order` — section order (default 300, after persona and tool guidance).
- `maxLessons` — maximum lessons per assembly or per relevant step (default 3).
- `minSeverity` — lowest severity to inject (default `beta`).

## Model Experience

### The forced-reflection section

#### What the model sees

When fingerprints exist, a `【系统强制反思】` block listing each lesson with its occurrence count. When there are none, the section renders empty and contributes nothing.

#### Token effect

Zero tokens with no fingerprints; otherwise the injected block (a few lines per lesson) on every assembly while fingerprints exist.

#### KV Cache effect

The section text changes when fingerprints are added or resolved, invalidating KV cache reuse from the first changed token.

### The passive relevance hook

#### What the model sees

On a proceeding step whose claimed text shares at least one token with a stored lesson, a `【相关记忆】` block is prepended before the claimed messages, naming why the lessons surface now. A step with no relevant lessons, a rejected step, or an aborted step injects nothing.

#### Token effect

Zero tokens when no lesson matches; otherwise the relevance block (a few lines per lesson, bounded by `maxLessons`) on that step only.

#### KV Cache effect

The injected context is a per-step user message, so it shifts the request prefix only on steps where it appears.

## Known Limitations and Deferred Work

- **Synchronous read** — the section reads the in-memory store synchronously, so a durable backend must keep a cached view.
- **Keyword overlap, not semantics** — relevance is token overlap, a cheap stand-in for embedding similarity; CJK text matches per character.
