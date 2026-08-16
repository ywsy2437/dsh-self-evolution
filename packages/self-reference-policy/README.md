# @deepseek-ai/dsh-self-reference-policy

English | [中文](README.zh.md)

Gates self-referential tool calls (name prefix `cordis` by default) through the `tools/pre-execute` waterfall with three levels: `requireApproval` (L3) → approval request; `shadowTestTools` (L2) → pre-flight through `ctx.shadowTester` in an isolated fork; everything else (L1) → allow. With both lists empty the policy is a no-op.

## Shape

- `selfReferencePrefix` — tool-name prefix marking self-referential calls (default `cordis`).
- `requireApproval` — L3 tool names that require approval.
- `shadowTestTools` — L2 tool names pre-flighted through the shadow tester.

## Model Experience

### Gate decisions

#### What the model sees

The gate itself injects no prompt and registers no tool. Its outcome is model-visible only through the tool result: an `ask` becomes an approval request, and a `deny` becomes a tool error whose reason names the shadow pre-flight failure.

#### Token effect

Zero direct tokens; a denied call adds one fixed error result to history.

#### KV Cache effect

Independent of live requests.

## Known Limitations and Deferred Work

- **L2 pre-flight blocks dispatch** — `tools/pre-execute` awaits the shadow subagent, so an L2 call is held until the pre-flight settles; no timeout/degradation is built in.
