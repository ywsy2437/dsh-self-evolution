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
                   ┌──────────┴───────────┐
                   ▼                      ▼
  lesson-injector（systemPrompt 段）  lesson-injector（agent/pre-step）
     近因排序（queryRecent）             相关性排序（queryRelevant）
                   │                      │
                   ▼                      ▼
     每次组装注入【系统强制反思】    step 推进前置入【相关记忆】
                   │
         （空闲时）offline-reflector
                   │
                   ▼
 根因分析 → evolution_patch 建议 → markResolved
```

记忆有两条被动读路径：`systemPrompt` 段常驻注入「近因教训」，`agent/pre-step` 钩子按关键词相关性把「任务相关教训」前置注入——两者都无需模型主动调用 `memory_query`。

## 关键设计决策

1. **不改 loop**：教训注入走 `systemPrompt.section()` 动态段与 `agent/pre-step` waterfall，而不是继承/改写 agent loop（DSH 规约："Plugins, not loop changes"）。
2. **被动激活优先**：记忆读取默认被动——`systemPrompt` 段（近因）+ `agent/pre-step`（相关性）自动注入，不依赖模型主动调用 `memory_query`；`memory_query` 只是同一条 `ctx.memory` 上的可选主动出口。
3. **事件驱动策略**：分级走 `tools/pre-execute` waterfall；矛盾观测走 `tools/result`；相关性注入走 `agent/pre-step`；不造"中枢网关"。
4. **能力 seam 三件套**：`memory` 是 Service Definition + Provider（`memory-sqlite`）+ Consumer（`tool-memory`、`lesson-injector` 等）。
5. **模型可见即持久化**：指纹经 `memory-sqlite` 写穿 storage KV，重启后"伤疤"仍在。
6. **生命周期安全**：语义化器在 `apply` 时捕获 `memory`/`llm` 服务实例，fire-and-forget 蒸馏在上下文销毁后仍能安全落库。
7. **自进化是核心阵地**：自修改权利（`cordis_define`/`cordis_run` 等）是第一等能力，记忆与被动注入是它的底层基础设施；插件与记忆模块在这一层连通，让 Agent 在推理中最大化利用 harness。

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
