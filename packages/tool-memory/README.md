# @deepseek-ai/dsh-tool-memory

English | [中文](README.zh.md)

Model-facing `memory_query` tool: reads the self-evolution meta-memory store (contradiction lessons and evolution records) so the agent can inspect its own accumulated "scars" on demand. Results are lossless-JSON scalars only.

## Shape

- `maxResults` — default result cap when the model omits `limit` (default 10).

## Model Experience

### The `memory_query` tool

#### What the model sees

The `memory_query` schema in every request, plus each call's string-summary result.

#### Token effect

The tool schema is a few dozen tokens per request; each call adds its bounded result.

#### KV Cache effect

The schema is stable, so requests stay only-append until the schema changes.

## Known Limitations and Deferred Work

- **String summaries only** — results are pre-formatted one-line summaries, not structured records.
