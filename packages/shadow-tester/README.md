# @deepseek-ai/dsh-shadow-tester

English | [中文](README.zh.md)

Shadow-testing service (`ctx.shadowTester`): pre-runs a high-risk self-modification in an isolated `fork` subagent before the main runtime applies it. A run that does not complete cleanly (or whose child reports failure) is recorded as a `shadow_failure` negative sample in `ctx.memory`.

## Shape

- `shadowTest(operation, parent, signal)` — spawn a `fork` subagent to evaluate the operation and record a negative sample on failure, returning `{ passed, warnings }`.

## Model Experience

### The fork pre-flight

#### What the model sees

Nothing on the main request. `ctx.shadowTester` registers no tool and injects no prompt; each `shadowTest` pre-flight spawns one auxiliary fork subagent whose verdict drives the caller's gate decision.

#### Token effect

Zero tokens on the main request; the fork subagent runs its own auxiliary turn.

#### KV Cache effect

The fork subagent is a separate child session; it does not touch the parent's request prefix.

## Known Limitations and Deferred Work

- **LLM-as-judge, not a sandbox** — the fork evaluates by reasoning and smoke reads; it does not provide a hard isolation boundary.
- **Text verdict parsing** — pass/fail is read from the child's `PASS`/`FAIL:` text, not a structured schema.
