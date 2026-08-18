# 进化效果基准（bench）

一个可复现的 A/B 基准：度量「相关教训注入」是否提升模型在 DeepSeek Harness（DSH）二开易错任务上的正确率。

## 运行

```sh
DEEPSEEK_API_KEY=sk-... node bench/run-bench.mjs [N]
```

- `N`：每个任务每个条件的采样次数（默认 3）。采样越多结果越稳，但调用次数 = `任务数 × 2 × N`。
- 需要网络可达 `https://api.deepseek.com`（可用 `DEEPSEEK_BASE_URL` 覆盖）。
- 结果打印到 stdout，并写入 `bench/REPORT.md`。

## 读结果

| 条件 | 含义 |
|---|---|
| 无教训（baseline） | system 只含中性提示，模拟「没有记忆的 Agent」 |
| 有教训（injected） | system 额外带一段【相关记忆】教训块，模拟 `lesson-injector` 的被动注入 |

两条基线用同一个规则 judge（关键词匹配）判对错，所以**差值方向可信**，绝对正确率仅供参考。

## 边界

- 度量的是「教训文本对模型行为的影响」，是进化增益的代理指标，不是完整「犯错 → 蒸馏 → 重犯」闭环的直接度量。
- 任务集（`tasks.mjs`）是本系统已蒸馏出的真实教训，可独立审阅和扩展。
