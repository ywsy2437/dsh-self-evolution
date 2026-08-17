# dsh-self-evolution —— 受控自进化 Agent

把「受控自进化 Agent 系统」落地为 DeepSeek Harness（`dsh`）的一组插件：让 Agent **记住自己的失败**、**带着伤疤反思**、**预检高风险自修改**、并**离线固化根因**。全部为标准 Cordis 插件，不修改 DSH 核心源码，关掉即回到原生行为。

> 核心哲学：自指向矛盾不是缺陷，而是 Agent 认知跃迁的"磨刀石"。本方案选择在 Harness 运行时内受控容纳、语义化并转化矛盾为进化信号，让 Agent 具备"应激进化"能力。

> **自进化是核心阵地**：修改自己代码（`cordis_define` / `cordis_run` 等）是 Agent 的第一等权利，而非附属能力；记忆中枢（`ctx.memory`）与被动注入是这块阵地的底层基础设施，让 Agent 在推理过程中**被动地**、无需主动选择地最大化利用自身积累的「伤疤」。

## 一、核心能力

一条四阶段转化管道：

```
矛盾触发 → 可逆回滚 → 语义蒸馏 → 教训注入 → 离线固化
   ↑             ↓            ↓            ↓            ↓
 自修改失败   Cordis disposer  LLM 翻译堆栈   注入 SystemPrompt  空闲时生成补丁
```

- **记住失败**：自修改失败不再静默回滚，而是被蒸馏成一条自然语言"因果教训"。
- **带着伤疤反思**：教训强制注入后续推理的 SystemPrompt，让 Agent 带着"痛感"重新规划。
- **被动激活（相关记忆注入）**：不依赖模型主动调用 `memory_query`——`agent/pre-step` 钩子在每次推理推进前按相关性把相关教训被动前置注入，与「强制反思段」形成「常驻近因 + 即时相关」的双层记忆读取。
- **影子预检**：高风险（L2）自修改先在隔离 fork 子代理里预演，失败即 fail-closed。
- **离线固化**：空闲时批量根因分析，把伤疤固化为可复用的补丁建议。

## 二、包结构（9 个插件）

| 包 | 角色 |
|---|---|
| `@deepseek-ai/dsh-memory` | Service Definition（`ctx.memory`）：矛盾指纹 + 元记录 |
| `@deepseek-ai/dsh-memory-sqlite` | 持久化 provider（storage KV 后端写穿） |
| `@deepseek-ai/dsh-contradiction-semanticizer` | `tools/result` 失败 → LLM 蒸馏 → 指纹；成功 → 记录 `success`（成功模式库） |
| `@deepseek-ai/dsh-lesson-injector` | 指纹 → 强制反思 `systemPrompt` 段 + `agent/pre-step` 相关性被动注入 |
| `@deepseek-ai/dsh-self-reference-policy` | `tools/pre-execute` L1/L2/L3 分级 |
| `@deepseek-ai/dsh-tool-memory` | 模型工具 `memory_query` |
| `@deepseek-ai/dsh-offline-reflector` | 定时根因分析 → 补丁建议 |
| `@deepseek-ai/dsh-shadow-tester` | `ctx.shadowTester`：fork 隔离预检 |
| `@deepseek-ai/dsh-task-evaluator` | 任务级三态 evaluator（`turn/end` → success/failure/inconclusive） |

## 三、快速开始

### 组合（追加到 `standard` 预设副本，或写进 profile 的 `cordis.patch.yml`）

```yaml
- id: self-evolution
  name: cordis:group
  group: true
  isolate:
    memory: true
    shadowTester: true
  config:
    - id: memory
      name: '@deepseek-ai/dsh-memory'

    - id: memory-sqlite
      name: '@deepseek-ai/dsh-memory-sqlite'
      config:
        backend: 'json'

    - id: contradiction-semanticizer
      name: '@deepseek-ai/dsh-contradiction-semanticizer'
      config:
        provider: 'deepseek-official'
        model: 'deepseek-v4-flash'

    - id: lesson-injector
      name: '@deepseek-ai/dsh-lesson-injector'

    - id: self-reference-policy
      name: '@deepseek-ai/dsh-self-reference-policy'
      config:
        shadowTestTools: ['cordis_run']

    - id: tool-memory
      name: '@deepseek-ai/dsh-tool-memory'

    - id: offline-reflector
      name: '@deepseek-ai/dsh-offline-reflector'
      config:
        provider: 'deepseek-official'
        model: 'deepseek-v4-flash'

    - id: shadow-tester
      name: '@deepseek-ai/dsh-shadow-tester'
```

### 体验完整链路

1. 在 Web UI 里选 `cordis` 预设（获得 `cordis_define` 等自修改工具）。
2. 让 Agent 故意失败一次：
   > 用 cordis_define 定义一个 host 代码有语法错误的插件
3. 等蒸馏完成后查询记忆：
   > 调用 memory_query kind='contradictions' 报告结果
4. 看到 **1 entry** 即闭环成功。

## 四、文档

- [研究笔记（先进经验 → 进化路线图）](docs/RESEARCH.zh.md)
- [架构设计](docs/ARCHITECTURE.zh.md)
- 每个包的 `README.md` / `README.zh.md` 含配置、Model Experience、已知限制。

## 五、验证状态

- 全仓 Host 聚合类型检查（`tsc -b tsconfig.host.json`）：exit 0
- 单元测试：46 passed（12 files）
- 真实 DeepSeek API 端到端：蒸馏落库、教训注入、L2 影子预检 fail-closed

## 六、License

[MIT](LICENSE)
