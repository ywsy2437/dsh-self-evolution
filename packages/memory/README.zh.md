# @deepseek-ai/dsh-memory

[English](README.md) | 中文

自进化能力的元记忆中枢（`ctx.memory`）：矛盾指纹库 + 通用元记忆记录。相同的 `(type, triggerOp)` 矛盾会折叠进同一条指纹（累加发生次数），而非累积重复项。默认内存存储；持久化 provider 通过 `mountStore()` 挂载 `MemoryStore`。

## Shape

- `recordFingerprint(input)` —— 把新矛盾折叠进指纹，返回存储后的指纹。
- `queryRecentContradictions(limit, minSeverity)` —— 按严重度阈值取最近指纹，最新在前。
- `queryUnsolvedContradictions(minSeverity, limit)` —— 取未解决指纹（供离线反思）。
- `markResolved(id, resolvedBy)` —— 把指纹标记为已由某补丁解决。
- `record(input)` / `listRecords()` —— 通用元记忆记录（影子失败、补丁、补丁失败）。
- `mountStore(store)` —— 换入持久 `MemoryStore`；返回的 disposer 恢复上一个 store。

读取是同步的，因为主要消费方是 `systemPrompt` 段 provider。

## Model Experience

### 指纹读写

#### 模型看到什么

直接看不到。`ctx.memory` 是 host 侧存储，不注册工具、不注入 prompt；由其它自进化包呈现指纹（教训注入器）或暴露查询工具（`memory_query`）。

#### Token 影响

每次请求零直接 token。

#### KV Cache 影响

与在线请求无关：存储从不触碰请求前缀，不会破坏 provider 缓存复用。

## Known Limitations and Deferred Work

- **默认内存态** —— 指纹是进程/作用域级；跨重启持久化需 `dsh-memory-sqlite`。
- **指纹 id 是进程本地** —— id 生成器不依赖平台 crypto 全局对象。
