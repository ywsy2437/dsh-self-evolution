# @deepseek-ai/dsh-heartbeat

[English](README.md) | 中文

给 Agent 的一个缓慢、审慎的脉搏。每 `heartbeatMs` 插件跳动一次——这是一次几乎零成本的节拍。只有当距上次深度思考过了 `thinkCooldownMs`，它才会停下来真正地想一次：一次以 `reasoningEffort`（默认 `max`）运行的 LLM 调用，让模型慢慢推理，而不是条件反射式地蹦出下一个 token。产生的「想法」写入 `ctx.memory`，并以 `heartbeat/idea` 事件发布，供渠道插件（写作文件渠道、微信 openclaw 渠道……）路由。

## Shape

- `provider` / `model` —— 想法生成调用的路由（必填）。
- `heartbeatMs` —— 节拍间隔（毫秒，默认 5000）；是节拍，不是想法。
- `thinkCooldownMs` —— 两次深度思考之间的最小停顿（默认 60000）。
- `reasoningEffort` —— `high` 或 `max`（默认 `max`）；`max` 即缓慢、审慎的推理。
- `maxTokens` —— 覆盖推理链 + 想法文本的总输出上限（默认 4096）。

## Model Experience

### 心跳

#### 模型看到什么

看不到。一次心跳只是本地定时器 tick，不产生模型调用。

#### Token 影响

每次心跳零 token。

#### KV Cache 影响

无：心跳不是请求，不触碰任何请求前缀。

### 想法

#### 模型看到什么

在冷却到期的某次心跳上，一次想法生成调用：先以配置的 effort 走推理链，再输出想法 JSON。想法落入 `ctx.memory`（一条 `thought` 记录，标签 `heartbeat` + 其 kind），并进入 `heartbeat/idea` 事件。

#### Token 影响

每个冷却窗口一次受限调用（上限 `maxTokens`），而不是每次心跳一次。

#### KV Cache 影响

每次想法都是一次全新的独立调用，不复用任何请求前缀。

## Known Limitations and Deferred Work

- **渠道在外部** —— 本插件只记录并发布事件；路由到文件或微信 openclaw 是另一个订阅 `heartbeat/idea` 的渠道插件。
- **推理延迟** —— `max` effort 下一次想法可能要几十秒，因此冷却时间须大于调用延迟以避免重叠（插件也从不重叠一个进行中的想法）。
