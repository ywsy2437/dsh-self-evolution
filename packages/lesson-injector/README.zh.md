# @deepseek-ai/dsh-lesson-injector

[English](README.md) | 中文

两条互补、被动地读取 `ctx.memory` 的路径，让模型在无需主动「选择调用」的情况下利用自身「伤疤」：

1. 一个 `systemPrompt` 段把最近的 β/γ 矛盾指纹渲染成强制反思块，每次 prompt 组装时求值。
2. 一个 `agent/pre-step` 钩子按「与 claimed 消息的关键词相关性」给指纹排序，并把 `【相关记忆】` 块前置，自动浮现与当前任务相关的教训。

## Shape

- `sectionName` —— 段名（默认 `self-evolution:lessons`）。
- `order` —— 段顺序（默认 300，在 persona 与工具引导之后）。
- `maxLessons` —— 每次组装或每个相关 step 最多注入条数（默认 3）。
- `minSeverity` —— 注入的最低严重度（默认 `beta`）。

## Model Experience

### 强制反思段

#### 模型看到什么

有指纹时，一个「【系统强制反思】」块，逐条列出教训及其发生次数。无指纹时该段为空、不贡献内容。

#### Token 影响

无指纹时零 token；有指纹时每次组装注入该块（每条教训几行）。

#### KV Cache 影响

指纹新增或解决会改变段文本，从第一个改变的 token 起破坏 KV 缓存复用。

### 被动相关性钩子

#### 模型看到什么

当一个「继续推进」的 step 其 claimed 文本与某条已存教训至少共享一个 token 时，会在 claimed 消息之前前置一个「【相关记忆】」块，说明为何此刻浮现这些教训。没有相关教训的 step、被拒绝的 step、或已中止的 step 都不注入。

#### Token 影响

没有匹配教训时零 token；有匹配时仅在该 step 注入相关性块（每条教训几行，受 `maxLessons` 约束）。

#### KV Cache 影响

注入的上下文是一条逐 step 的 user 消息，只在它出现的 step 上移动请求前缀。

## Known Limitations and Deferred Work

- **同步读取** —— 该段同步读取内存存储，持久化后端须保持缓存视图。
- **关键词重叠而非语义** —— 相关性是 token 重叠，是 embedding 相似度的廉价替代；中文文本按单字匹配。
