# @deepseek-ai/dsh-task-evaluator

[English](README.md) | 中文

任务级三态 evaluator：监听持久 `turn/end` 会话事件，把每轮任务结局——`success` / `failure` / `inconclusive`——记录为 `ctx.memory` 里的 `task_outcome` 记录。这提供 Reflexion 式「Evaluator」信号：判定的是整轮任务是否成功，而非单个工具调用是否报错。

## Shape

- `classifyOutcome(reasonKind)` —— `completed` → `success`，`error` → `failure`，其余（`aborted`/`blocked`/`max-tokens`/`interrupted`）→ `inconclusive`。
- 记录 `{ type: 'task_outcome', payload: { outcome, turn, reasonKind }, tags: ['task_outcome', outcome] }`。

## Model Experience

### 任务结局记录

#### 模型看到什么

直接看不到。它把 `task_outcome` 记录写进 `ctx.memory`，可经 `memory_query kind='records'` 查询。

#### Token 影响

主请求零 token。

#### KV Cache 影响

与在线请求无关。

## Known Limitations and Deferred Work

- **只记录结局、不裁决** —— `inconclusive` 是合法终态；evaluator 从不强判成败。
- **未关联 goal** —— 记录轮次结局，但尚未与 goal 完成事件关联。
