import { describe, expect, it } from 'vitest'
import { analysisPrompt } from '../src/index.ts'
import type { ContradictionFingerprint } from '@deepseek-ai/dsh-memory'

function fingerprint(semanticLesson: string): ContradictionFingerprint {
  return {
    id: 'fp-1' as never,
    type: 'gamma',
    triggerOp: 'migrate',
    semanticLesson,
    causalChain: [],
    occurrenceCount: 1,
    lastOccurrence: 1,
  }
}

describe('analysisPrompt', () => {
  it('lists the lessons and asks for a JSON object', () => {
    const prompt = analysisPrompt([fingerprint('lesson A'), fingerprint('lesson B')])
    expect(prompt).toContain('lesson A')
    expect(prompt).toContain('lesson B')
    expect(prompt).toContain('2 次状态迁移撕裂矛盾')
    expect(prompt).toContain('"rootCause"')
  })
})
