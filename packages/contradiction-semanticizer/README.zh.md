# @deepseek-ai/dsh-contradiction-semanticizer

[English](README.md) | 中文

监听自引用工具（默认名字前缀 `cordis`）的 `tools/result` 失败，经 LLM seam 把每次失败蒸馏成自然语言因果教训，记录为 `ctx.memory` 里的 `ContradictionFingerprint`。蒸馏是 best-effort，且总会落一条指纹（模型调用失败时用 fallback 教训）。

## Shape

- `provider` / `model` —— 辅助蒸馏调用的路由（必填）。
- `maxLessonWords` —— 教训字数上限（默认 50）。
- `selfReferenceToolPrefix` —— 标记自引用调用的工具名前缀（默认 `cordis`）。

## Model Experience

### 蒸馏调用

#### 模型看到什么

主请求上直接看不到。每个失败的自引用工具触发一次辅助模型调用（蒸馏），其教训落到 `ctx.memory`，之后由教训注入器呈现。

#### Token 影响

主请求零 token；每次失败一次辅助调用，`maxTokens: 256` 封顶。

#### KV Cache 影响

辅助调用是独立请求，不触碰对话前缀。

## Known Limitations and Deferred Work

- **α/β/γ 分级是启发式** —— migrate/data/schema 失败归 `gamma`，否则 `beta`；静默 `alpha` 矛盾不蒸馏。
- **provider/model 必填** —— 部署方须显式路由辅助调用（错误配置即报错）。
