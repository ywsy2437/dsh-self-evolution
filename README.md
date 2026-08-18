# dsh-self-evolution — Controlled Self-Evolving Agent

A set of DeepSeek Harness (`dsh`) plugins implementing a **controlled self-evolving agent**: distill self-modification failures into natural-language causal lessons, inject them into later reasoning, pre-flight high-risk operations, and consolidate scars into patch suggestions. All standard Cordis plugins — no core source is modified, and disabling them restores native `dsh` behavior.

See [README.zh.md](README.zh.md) (中文) for the full guide.

## Pipeline

```
contradiction → reversible rollback → semantic distillation → lesson injection → offline consolidation
```

Lessons reach the model two passive ways: a recency-ranked `systemPrompt` section, plus a relevance-ranked `agent/pre-step` hook that prepends task-specific lessons before each proceeding step — no opt-in tool call required.

## Packages (9)

`memory`, `memory-sqlite`, `contradiction-semanticizer`, `lesson-injector`, `self-reference-policy`, `tool-memory`, `offline-reflector`, `shadow-tester`, `task-evaluator`.

## Docs

- [Development report (formal)](docs/DEVELOPMENT-REPORT.zh.md)
- [Research notes (prior art → evolution roadmap)](docs/RESEARCH.zh.md)
- [Architecture](docs/ARCHITECTURE.zh.md)
- [Evolution benchmark (lesson-injection A/B)](bench/README.md)

## Authors

小S (Shan Yu) & 小D (DeepSeek)

## License

[MIT](LICENSE)
