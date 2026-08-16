# @deepseek-ai/dsh-offline-reflector

[English](README.md) | 中文

定时从 `ctx.memory` 批量取未解决的 γ 矛盾，经 LLM seam 做根因分析，把补丁建议记为 `evolution_patch` 记录，并把指纹标记为已解决。它只负责「把伤疤固化为持久根因」这一步；应用补丁是自修改工具的职责。

## Shape

- `provider` / `model` —— 根因分析调用的路由（必填）。
- `intervalMs` —— 轮询间隔（默认 60000）。
- `minUnsolved` —— 累积到至少这么多未解决 γ 指纹才分析（默认 5）。
- `maxReflections` —— 每次分析的最大指纹数（默认 20）。

## Model Experience

### 根因分析调用

#### 模型看到什么

主请求上直接看不到。每次分析是一次辅助模型调用，其补丁建议落到 `ctx.memory`。

#### Token 影响

主请求零 token；每批分析一次辅助调用，`maxTokens: 1024` 封顶。

#### KV Cache 影响

辅助调用是独立请求，不触碰对话前缀。

## Known Limitations and Deferred Work

- **只建议、不应用** —— 反思器记录补丁建议并标记指纹已解决，但不改动配置、不重载插件。
- **定时而非空闲触发** —— 反思按定时器运行，而非仅实例空闲时。
