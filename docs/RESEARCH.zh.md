# 研究笔记：先进经验 → 受控自进化插件

> 本文是「受控自进化 Agent」（dsh-self-evolution）的调研笔记：从 GitHub / arXiv 上的自进化 Agent、记忆、反思前沿工作里，提炼可复用的机制，映射到本项目的组件，并给出进化路线图。

## 一、调研对象与核心映射

| 工作 | 核心机制 | 本项目对应组件 | 差距 / 可进化点 |
|---|---|---|---|
| **Reflexion**（语言智能体的语言强化学习） | 失败触发 → 语言化自我反馈 → 存入情景记忆 → 下次检索 | `semanticizer`（失败蒸馏）+ `memory`（情景记忆）+ `lesson-injector`（检索注入） | Reflexion 有显式 Evaluator 判定**任务级成败**；本项目只监听 `tools/result` 的 `isError`（工具级失败） |
| **SAGE**（自进化智能体） | 反思 + 记忆增强的自进化闭环 | 整个四阶段管道（矛盾→蒸馏→注入→固化） | SAGE 的记忆检索按**语义相关性**；本项目按严重度+时间 |
| **ParamMem**（参数化反思记忆） | 反思不止存文本，还**更新参数**实现固化 | `offline-reflector`（固化） | 本项目的固化只记录补丁建议，不真正改配置/参数 |
| **Voyager**（自驱动技能库） | 试错构建**可复用的成功技能库** | 无对应（本项目只存失败指纹） | 缺「成功模式」库，只学了"什么会坏"，没学"什么能成" |
| **Generative Agents** | 记忆流 + 反思 + 规划 | `memory`（记忆流）+ `semanticizer`/`reflector`（反思） | 记忆的检索/衰减/重要性评分可借鉴 |
| **ACE**（Agentic Context Engineering） | 智能体**自主工程化自身上下文** | `lesson-injector`（上下文注入） | 上下文注入的**时机与预算**可更精细 |

## 二、可落地的进化项（按价值排序）

1. **相关性检索**（来自 Reflexion / SAGE）
   - 现状：`lesson-injector` 只按「严重度 ≥ beta + 时间倒序」取最近指纹。
   - 进化：按**当前任务上下文与指纹教训的语义相关性**检索，让模型看到"这次用得上"的伤疤，而非"最近"的伤疤。
   - 落地：轻量版可用关键词/工具名匹配；完整版接 embedding。

2. **任务级成败信号**（来自 Reflexion 的 Evaluator）
   - 现状：`semanticizer` 只监听 `tools/result`（工具级失败）。
   - 进化：同时监听 `agent/request-error`（模型/传输失败）与 `turn/end` 的 error reason，捕获"没有单点工具失败但任务整体失败"的矛盾。

3. **成功模式库**（来自 Voyager）✅ 已实现
   - 现状：只记录 `shadow_failure` / 失败指纹（负样本）。
   - 进化：`contradiction-semanticizer` 现在也在自修改操作**成功**时记录一条 `success` 记录（可配 `recordSuccess`，默认开），与失败指纹互补，形成双向学习；经 `memory_query kind='records'` 可查。

4. **深度固化**（来自 ParamMem）
   - 现状：`offline-reflector` 生成补丁建议后仅 `markResolved`，不真正应用。
   - 进化：在安全门控（L1 低风险 + 快照 + 可回滚）下，把固化结果真正写回配置/参数，实现"肌肉记忆"。

## 三、参考链接

- Reflexion: Language Agents with Verbal Reinforcement Learning — <https://arxiv.org/abs/2303.11366>
- SAGE: Self-evolving Agents with Reflective and Memory-augmented Abilities — <https://arxiv.org/abs/2409.00872>
- ParamMem: Augmenting Language Agents with Parametric Reflective Memory — <https://huggingface.co/buckets/huggingchat/papers-content/tree/2602/2602.23320.md>
- ACE（Agentic Context Engineering）开源 — <https://sambanova.ai/blog/ace-open-sourced-on-github>
- Generative Agents: Interactive Simulacra of Human Behavior — <https://arxiv.org/abs/2304.03442>
- Voyager: An Open-Ended Embodied Agent with LLMs — <https://arxiv.org/abs/2305.16291>
