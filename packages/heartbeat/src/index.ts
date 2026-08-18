/**
 * Heartbeat: a slow, deliberate pulse for the agent.
 *
 * Every `heartbeatMs` the plugin ticks (the "heartbeat"); a lightweight beat
 * that costs nothing. Only when enough time has passed since the last deep
 * thought (`thinkCooldownMs`) does it actually stop to think — one LLM call at
 * `reasoningEffort` (default `max`) so the model reasons slowly instead of
 * emitting the next token on reflex. The resulting "idea" is recorded into
 * `ctx.memory` and published as a `heartbeat/idea` event, which channel plugins
 * (a writing-file channel, a WeChat/openclaw channel, …) subscribe to.
 *
 * The beat is a metronome; the thought is what gives it a pulse.
 *
 * @module @deepseek-ai/dsh-heartbeat
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { BlockAssembler, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
// Type-only: loads the `ctx.memory` augmentation.
import type {} from '@deepseek-ai/dsh-memory'
// Type-only: loads the `ctx.interval` timer mixin augmentation.
import type {} from '@deepseek-ai/cordis-plugin-timer'

export const name = 'heartbeat'
export const inject = ['timer', 'memory', 'llm']

/** Model-facing heartbeat configuration. */
export interface Config {
  /** Provider route for the idea-generation call. */
  provider: string
  /** Model id for the idea-generation call. */
  model: string
  /** Metronome interval in milliseconds; the beat, not the thought. */
  heartbeatMs: number
  /** Minimum pause between two deep thoughts, in milliseconds. */
  thinkCooldownMs: number
  /** Reasoning effort for the thought; `max` means slow, deliberate reasoning. */
  reasoningEffort: 'high' | 'max'
  /** Total output cap, covering both the reasoning chain and the idea text. */
  maxTokens: number
}

/** Schemastery configuration for the heartbeat. */
export const Config: z<Config> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  heartbeatMs: z.natural().default(5000),
  thinkCooldownMs: z.natural().default(60000),
  reasoningEffort: z.union([z.const('high' as const), z.const('max' as const)]).default('max' as const),
  maxTokens: z.natural().default(4096),
})

/** The kinds of idea the agent may produce on a beat. */
export const IDEA_KINDS = ['thought', 'evolution', 'writing', 'chat', 'inspiration'] as const

/** One produced idea. */
export interface HeartbeatIdea {
  kind: (typeof IDEA_KINDS)[number]
  content: string
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Published after each idea is recorded, so channel plugins can route it
     * (a writing channel appends to a file, a WeChat channel sends a message).
     * @param idea - the produced idea.
     * @mode emit
     */
    'heartbeat/idea'(idea: HeartbeatIdea): void
  }
}

/**
 * Build the idea-generation prompt: ask the model to slow down and produce one
 * of its own notions rather than answering a question.
 * @returns the model prompt.
 */
export function ideaPrompt(): string {
  return `你现在是一个「有心跳的 Agent」。请放慢、审慎地思考，产出一个属于你自己的念头，而不是回答任何问题。

这个念头可以是（任选其一）：
- thought：关于你自身状态、目标或最近经验的思考
- evolution：一个自进化的想法（你想如何改进自己）
- writing：一个创作/写作的灵感（小说片段、随笔、诗歌）
- chat：一句想主动对主人说的话
- inspiration：一个突如其来的灵感或冲动

请先在心中慢慢想清楚，然后只输出一个 JSON 对象（不要输出任何其他文字）：
{"kind":"thought|evolution|writing|chat|inspiration","content":"你的念头内容"}`
}

/**
 * Normalize an arbitrary kind string into a {@link HeartbeatIdea} kind.
 * @param kind - the model-reported kind.
 * @returns a legal kind, or `thought` for an unknown value.
 */
export function normalizeKind(kind: string): HeartbeatIdea['kind'] {
  return (IDEA_KINDS as readonly string[]).includes(kind)
    ? kind as HeartbeatIdea['kind']
    : 'thought'
}

/**
 * Parse the model text into a {@link HeartbeatIdea}; falls back to a `thought`
 * carrying the raw text when the model did not return clean JSON.
 * @param text - the accumulated model text.
 * @returns a parsed idea.
 */
export function parseIdea(text: string): HeartbeatIdea {
  const match = text.match(/\{[\s\S]*\}/)
  if (match !== null) {
    try {
      const parsed = JSON.parse(match[0]) as { kind?: unknown; content?: unknown }
      if (typeof parsed.content === 'string' && parsed.content.length > 0) {
        return { kind: normalizeKind(String(parsed.kind ?? 'thought')), content: parsed.content }
      }
    } catch {
      // Fall through to the raw-text fallback.
    }
  }
  return { kind: 'thought', content: text.trim() }
}

/**
 * Run one slow idea-generation call and return the idea plus its reasoning trace.
 * @param llm - the LLM service instance.
 * @param config - heartbeat configuration.
 * @returns the idea and the raw reasoning text, or `undefined` on failure.
 */
async function think(llm: LlmRuntime, config: Config): Promise<{ idea: HeartbeatIdea; reasoning: string } | undefined> {
  const message = createUserMessage({
    content: [{ type: 'text', text: ideaPrompt() }],
    source: { kind: 'plugin', plugin: name },
  })
  const assembler = new BlockAssembler()
  const stream = llm.stream({
    provider: config.provider,
    model: config.model,
    messages: [message],
    maxTokens: config.maxTokens,
    reasoningEffort: ReasoningEffortId(config.reasoningEffort),
  })
  for await (const chunk of stream) {
    assembler.push(chunk)
  }
  const blocks = assembler.blocks()
  const text = blocks.filter(block => block.type === 'text').map(block => block.text).join(' ').trim()
  const reasoning = blocks.filter(block => block.type === 'reasoning').map(block => block.text).join(' ').trim()
  if (text.length === 0) return undefined
  return { idea: parseIdea(text), reasoning }
}

/**
 * Register the heartbeat metronome. A running thought is never overlapped, and
 * the beat only pauses for a new thought once `thinkCooldownMs` has elapsed.
 * @param ctx - registrant context carrying `timer`, `memory`, and `llm`.
 * @param config - heartbeat configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const memory = ctx.memory
  const llm = ctx.llm
  let running = false
  let lastThought = 0
  ctx.interval(() => {
    if (running) return
    const now = Date.now()
    // The beat fires constantly; the thought waits for its own slower tempo.
    if (now - lastThought < config.thinkCooldownMs) return
    running = true
    lastThought = now
    void (async () => {
      try {
        const result = await think(llm, config)
        if (result === undefined) return
        memory.record({
          type: 'thought',
          payload: { kind: result.idea.kind, content: result.idea.content, reasoning: result.reasoning },
          tags: ['heartbeat', result.idea.kind],
        })
        ctx.emit('heartbeat/idea', result.idea)
      } catch {
        memory.record({ type: 'thought_failure', payload: { reason: 'idea-failed' }, tags: ['heartbeat'] })
      } finally {
        running = false
      }
    })()
  }, config.heartbeatMs)
}
