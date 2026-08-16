# @deepseek-ai/dsh-lesson-injector

English | [中文](README.zh.md)

Registers a `systemPrompt` section whose text reads the most recent β/γ contradiction fingerprints from `ctx.memory` and renders them as a forced-reflection block. The section text is evaluated at every prompt assembly, so the model always sees the current "scars" without any loop change.

## Shape

- `sectionName` — section name (default `self-evolution:lessons`).
- `order` — section order (default 300, after persona and tool guidance).
- `maxLessons` — maximum lessons per assembly (default 3).
- `minSeverity` — lowest severity to inject (default `beta`).

## Model Experience

### The forced-reflection section

#### What the model sees

When fingerprints exist, a `【系统强制反思】` block listing each lesson with its occurrence count. When there are none, the section renders empty and contributes nothing.

#### Token effect

Zero tokens with no fingerprints; otherwise the injected block (a few lines per lesson) on every assembly while fingerprints exist.

#### KV Cache effect

The section text changes when fingerprints are added or resolved, invalidating KV cache reuse from the first changed token.

## Known Limitations and Deferred Work

- **Synchronous read** — the section reads the in-memory store synchronously, so a durable backend must keep a cached view.
