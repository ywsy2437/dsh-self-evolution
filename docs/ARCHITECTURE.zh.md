# 架构设计

## 数据流

```
                 ┌──────────────────────────────────────────────┐
                 │                 Agent（自修改）               │
                 │  cordis_define / cordis_run / cordis_*        │
                 └──────────────┬───────────────────────────────┘
                                │ tools/pre-execute（分级）
        ┌───────────────────────┼───────────────────────────────┐
        │ L1 放行               │ L2 影子预检                    │ L3 审批
        │                       │  shadow-tester → fork 子代理    │  → ask
        │                       └──────────┬─────────────────────┘
        │                                  │ fail → deny
        ▼                                  ▼
  tools/execute ──失败──▶ tools/result (isError)
                              │
                              ▼
              contradiction-semanticizer（ctx.llm 蒸馏）
                              │
                              ▼
                    ctx.memory.recordFingerprint
                     （memory + memory-sqlite 持久化）
                              │
                              ▼
              lesson-injector（systemPrompt 段，读指纹）
                              │
                              ▼
              下次推理注入【系统强制反思】
                              │
                    （空闲时）offline-reflector
                              │
                              ▼
              根因分析 → evolution_patch 建议 → markResolved
```

## 关键设计决策

1. **不改 loop**：教训注入走 `systemPrompt.section()` 动态段，而不是继承/改写 agent loop（DSH 规约："Plugins, not loop changes"）。
2. **事件驱动策略**：分级走 `tools/pre-execute` waterfall；矛盾观测走 `tools/result`；不造"中枢网关"。
3. **能力 seam 三件套**：`memory` 是 Service Definition + Provider（`memory-sqlite`）+ Consumer（`tool-memory` 等）。
4. **模型可见即持久化**：指纹经 `memory-sqlite` 写穿 storage KV，重启后"伤疤"仍在。
5. **生命周期安全**：语义化器在 `apply` 时捕获 `memory`/`llm` 服务实例，fire-and-forget 蒸馏在上下文销毁后仍能安全落库。

## 三级矛盾分类

| 级 | 含义 | 处理 |
|---|---|---|
| α | 低价值、可静默回滚 | 不蒸馏 |
| β | 状态语义突变（高价值） | 蒸馏 + 注入 + 固化 |
| γ | 迁移数据撕裂（极高价值） | 蒸馏 + 注入 + 影子预检 + 固化 |

## 已知限制

- 语义化蒸馏是 fire-and-forget（异步），与紧接其后的查询存在时序竞态；常驻进程里会最终落库。
- `offline-reflector` 只固化补丁建议，不真正应用（深度固化见 RESEARCH 路线图）。
- 影子预检是 fork 上的 LLM 裁决，非硬沙箱隔离边界。
