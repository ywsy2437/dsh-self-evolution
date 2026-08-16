# @deepseek-ai/dsh-shadow-tester

[English](README.md) | 中文

影子试验服务（`ctx.shadowTester`）：在主运行时应用某个高风险自修改之前，先在隔离的 `fork` 子代理里预跑。未干净结束（或子代理报告失败）的运行会记为 `ctx.memory` 里的 `shadow_failure` 负样本。

## Shape

- `shadowTest(operation, parent, signal)` —— 派生一个 `fork` 子代理评估操作，失败时记录负样本，返回 `{ passed, warnings }`。

## Model Experience

### fork 预检

#### 模型看到什么

主请求上看不到。`ctx.shadowTester` 不注册工具、不注入 prompt；每次 `shadowTest` 预检派生一个辅助 fork 子代理，其裁决驱动调用方的分级决策。

#### Token 影响

主请求零 token；fork 子代理跑自己的辅助回合。

#### KV Cache 影响

fork 子代理是独立子会话，不触碰父请求前缀。

## Known Limitations and Deferred Work

- **LLM 裁决而非沙箱** —— fork 通过推理与冒烟读取评估，不提供硬隔离边界。
- **文本裁决解析** —— 通过/失败从子代理的 `PASS`/`FAIL:` 文本读取，非结构化 schema。
