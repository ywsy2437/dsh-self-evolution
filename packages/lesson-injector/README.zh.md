# @deepseek-ai/dsh-lesson-injector

[English](README.md) | 中文

注册一个 `systemPrompt` 段，其文本读取 `ctx.memory` 里最近的 β/γ 矛盾指纹，渲染成强制反思块。段文本在每次 prompt 组装时求值，因此模型始终看到当前「伤疤」，无需改动 loop。

## Shape

- `sectionName` —— 段名（默认 `self-evolution:lessons`）。
- `order` —— 段顺序（默认 300，在 persona 与工具引导之后）。
- `maxLessons` —— 每次组装最多注入条数（默认 3）。
- `minSeverity` —— 注入的最低严重度（默认 `beta`）。

## Model Experience

### 强制反思段

#### 模型看到什么

有指纹时，一个「【系统强制反思】」块，逐条列出教训及其发生次数。无指纹时该段为空、不贡献内容。

#### Token 影响

无指纹时零 token；有指纹时每次组装注入该块（每条教训几行）。

#### KV Cache 影响

指纹新增或解决会改变段文本，从第一个改变的 token 起破坏 KV 缓存复用。

## Known Limitations and Deferred Work

- **同步读取** —— 该段同步读取内存存储，持久化后端须保持缓存视图。
