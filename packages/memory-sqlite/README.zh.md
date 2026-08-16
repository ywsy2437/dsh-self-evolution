# @deepseek-ai/dsh-memory-sqlite

[English](README.md) | 中文

`ctx.memory` 的持久化 provider：把 `MemoryStore` 挂到 storage KV 后端（默认 `sqlite`）。挂载时把整份快照载入进程内存，保证同步读仍然快；每次变更再写穿到后端。

## Shape

- `backend` —— 提供 KV facet 的 storage 后端名（默认 `sqlite`）。
- `unitName` —— KV unit 名（默认 `memory`）。
- `version` —— KV unit 格式版本。

## Model Experience

### 快照载入与写穿

#### 模型看到什么

看不到。`ctx.memory` 保持其同步内存读路径；本包只换掉它的 `MemoryStore` 持久化后端。不注册工具、不注入 prompt。

#### Token 影响

每次请求零直接 token。

#### KV Cache 影响

与在线请求无关。

## Known Limitations and Deferred Work

- **fire-and-forget 持久性** —— 变更同步更新内存副本、异步写穿；崩溃可能丢失最后一次写入。
- **信任同格式数据** —— 持久化边界对载入值做转换，不跨版本校验。
