# @deepseek-ai/dsh-heartbeat

English | [中文](README.zh.md)

A slow, deliberate pulse for the agent. Every `heartbeatMs` the plugin ticks — a metronome beat that costs nothing. Only when enough time has passed since the last deep thought (`thinkCooldownMs`) does it stop to think: one LLM call at `reasoningEffort` (default `max`) so the model reasons slowly instead of emitting the next token on reflex. The resulting "idea" is recorded into `ctx.memory` and published as a `heartbeat/idea` event for channel plugins (a writing-file channel, a WeChat/openclaw channel, …) to route.

## Shape

- `provider` / `model` — route for the idea-generation call (required).
- `heartbeatMs` — metronome interval in milliseconds (default 5000); the beat, not the thought.
- `thinkCooldownMs` — minimum pause between two deep thoughts (default 60000).
- `reasoningEffort` — `high` or `max` (default `max`); `max` means slow, deliberate reasoning.
- `maxTokens` — total output cap covering reasoning chain plus idea text (default 4096).

## Model Experience

### The heartbeat

#### What the model sees

Nothing. A beat is a local timer tick; it makes no model call.

#### Token effect

Zero tokens per beat.

#### KV Cache effect

None: beats are not requests, so they never touch a request prefix.

### The thought

#### What the model sees

On a cooldown-elapsed beat, one idea-generation call whose reasoning chain runs at the configured effort, then the idea JSON. The idea lands in `ctx.memory` (a `thought` record tagged `heartbeat` + its kind) and on the `heartbeat/idea` event.

#### Token effect

One bounded call (up to `maxTokens`) per cooldown window, not per beat.

#### KV Cache effect

Each thought is a fresh standalone call; it reuses no request prefix.

## Known Limitations and Deferred Work

- **Channels are external** — the plugin records and emits; routing to a file or WeChat/openclaw is a separate channel plugin subscribing to `heartbeat/idea`.
- **Reasoning latency** — at `max` effort a single thought can take tens of seconds, so the cooldown must exceed the call latency to avoid overlap (the plugin also never overlaps a running thought).
