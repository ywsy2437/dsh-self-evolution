# @deepseek-ai/dsh-tool-memory

[English](README.md) | 中文

模型可见的 `memory_query` 工具：读取自进化元记忆存储（矛盾教训与进化记录），让 agent 按需检视自己累积的「伤疤」。结果仅 lossless-JSON 标量。

## Shape

- `maxResults` —— 模型省略 `limit` 时的默认结果上限（默认 10）。

## Model Experience

### `memory_query` 工具

#### 模型看到什么

每次请求中的 `memory_query` schema，以及每次调用的字符串摘要结果。

#### Token 影响

工具 schema 每次请求几十 token；每次调用加上有界的结果。

#### KV Cache 影响

schema 稳定，请求保持仅追加，直到 schema 变化。

## Known Limitations and Deferred Work

- **仅字符串摘要** —— 结果是预格式化的单行摘要，非结构化记录。
