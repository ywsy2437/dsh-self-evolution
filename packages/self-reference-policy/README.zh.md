# @deepseek-ai/dsh-self-reference-policy

[English](README.md) | 中文

通过 `tools/pre-execute` waterfall 对自引用工具调用（默认名字前缀 `cordis`）做三级分级：`requireApproval`（L3）→ 审批请求；`shadowTestTools`（L2）→ 经 `ctx.shadowTester` 在隔离 fork 里预检；其余（L1）→ 放行。两个列表都为空时策略是空操作。

## Shape

- `selfReferencePrefix` —— 标记自引用调用的工具名前缀（默认 `cordis`）。
- `requireApproval` —— 需审批的 L3 工具名。
- `shadowTestTools` —— 经影子试验预检的 L2 工具名。

## Model Experience

### 分级裁决

#### 模型看到什么

分级本身不注入 prompt、不注册工具。其结果只通过工具结果对模型可见：`ask` 变成审批请求，`deny` 变成工具错误，原因指明影子预检失败。

#### Token 影响

零直接 token；被拒绝的调用给历史加一条固定错误结果。

#### KV Cache 影响

与在线请求无关。

## Known Limitations and Deferred Work

- **L2 预检阻塞分派** —— `tools/pre-execute` 等待影子子代理，L2 调用被挂起直到预检结束；未内置超时/降级。
