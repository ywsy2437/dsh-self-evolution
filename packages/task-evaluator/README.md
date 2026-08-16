# @deepseek-ai/dsh-task-evaluator

English | [中文](README.zh.md)

Task-level three-state evaluator: observes the persistent `turn/end` session event and records each turn's outcome — `success`, `failure`, or `inconclusive` — as a `task_outcome` record in `ctx.memory`. This supplies the Reflexion-style "Evaluator" signal: whether a whole task succeeded, not merely whether one tool call errored.

## Shape

- `classifyOutcome(reasonKind)` — maps `completed` → `success`, `error` → `failure`, everything else (`aborted`/`blocked`/`max-tokens`/`interrupted`) → `inconclusive`.
- Records `{ type: 'task_outcome', payload: { outcome, turn, reasonKind }, tags: ['task_outcome', outcome] }`.

## Model Experience

### Turn-outcome records

#### What the model sees

Nothing directly. It writes `task_outcome` records into `ctx.memory`, which `memory_query kind='records'` can surface.

#### Token effect

Zero tokens on the main request.

#### KV Cache effect

Independent of live requests.

## Known Limitations and Deferred Work

- **Outcome, not verdict** — `inconclusive` is a legitimate terminal state; the evaluator never forces a success/failure call.
- **No goal correlation** — it records turn outcomes but does not yet join them to goal completion.
