# dsh-self-evolution — Controlled Self-Evolving Agent

A set of DeepSeek Harness (`dsh`) plugins implementing a **controlled self-evolving agent**: distill self-modification failures into natural-language causal lessons, inject them into later reasoning, pre-flight high-risk operations, and consolidate scars into patch suggestions. All standard Cordis plugins — no core source is modified, and disabling them restores native `dsh` behavior.

See [README.zh.md](README.zh.md) (中文) for the full guide.

## Pipeline

```
contradiction → reversible rollback → semantic distillation → lesson injection → offline consolidation
```

## Packages (8)

`memory`, `memory-sqlite`, `contradiction-semanticizer`, `lesson-injector`, `self-reference-policy`, `tool-memory`, `offline-reflector`, `shadow-tester`.

## Docs

- [Research notes (prior art → evolution roadmap)](docs/RESEARCH.zh.md)
- [Architecture](docs/ARCHITECTURE.zh.md)

## License

[MIT](LICENSE)
