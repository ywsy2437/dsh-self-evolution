import { describe, expect, it } from 'vitest'
import { decide, shadowGateDecision } from '../src/index.ts'

describe('decide', () => {
  it('returns null for non-self-referential tools', () => {
    expect(decide('tool-bash', 'cordis', [])).toBeNull()
  })

  it('allows self-referential tools not in the approval list', () => {
    expect(decide('cordis_define', 'cordis', [])).toBe('allow')
    expect(decide('cordis_run', 'cordis', ['cordis_define'])).toBe('allow')
  })

  it('asks for self-referential tools in the approval list', () => {
    expect(decide('cordis_define', 'cordis', ['cordis_define'])).toBe('ask')
  })
})

describe('shadowGateDecision', () => {
  it('asks when the pre-flight is unavailable', () => {
    const decision = shadowGateDecision('cordis_run', undefined)
    expect(decision).toEqual({ kind: 'ask', reason: expect.stringContaining('shadow pre-flight (unavailable)') })
  })

  it('denies a failed pre-flight with its warnings', () => {
    const decision = shadowGateDecision('cordis_run', { passed: false, warnings: ['data schema mismatch'] })
    expect(decision).toEqual({ kind: 'deny', reason: expect.stringContaining('data schema mismatch') })
  })

  it('delegates (allows) a passed pre-flight', () => {
    expect(shadowGateDecision('cordis_run', { passed: true, warnings: [] })).toBeNull()
  })
})
