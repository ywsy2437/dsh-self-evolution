# @deepseek-ai/dsh-memory-sqlite

English | [中文](README.zh.md)

Durable provider for `ctx.memory`: mounts a `MemoryStore` over a storage KV backend (`sqlite` by default). On mount it loads the full snapshot into process memory so the synchronous reads stay fast, then writes each mutation through to the backend.

## Shape

- `backend` — storage backend name that serves the KV facet (default `sqlite`).
- `unitName` — KV unit name (default `memory`).
- `version` — KV unit format version.

## Model Experience

### Snapshot load and write-through

#### What the model sees

Nothing. `ctx.memory` keeps its synchronous in-memory read path; this package only swaps its `MemoryStore` persistence backend. It registers no tool and injects no prompt.

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests.

## Known Limitations and Deferred Work

- **Fire-and-forget durability** — mutations update the in-memory copy synchronously and write through asynchronously; a crash can lose the last write.
- **Trusted same-format data** — the durable boundary casts loaded values without cross-version validation.
