import { describe, expect, it } from 'vitest'
import { classifyContradiction, distillationPrompt } from '../src/index.ts'

describe('classifyContradiction', () => {
  it('classifies data/migration failures as gamma', () => {
    expect(classifyContradiction('cordis_run', 'migration failed: missing column')).toBe('gamma')
    expect(classifyContradiction('migrate_plugin', 'boom')).toBe('gamma')
    expect(classifyContradiction('cordis_run', 'data schema mismatch')).toBe('gamma')
  })

  it('classifies ordinary failures as beta', () => {
    expect(classifyContradiction('cordis_run', 'unknown tool')).toBe('beta')
    expect(classifyContradiction('cordis_define', 'syntax error')).toBe('beta')
  })
})

describe('distillationPrompt', () => {
  it('embeds the operation, error, and word bound', () => {
    const prompt = distillationPrompt('cordis_define', 'boom', 50)
    expect(prompt).toContain('cordis_define')
    expect(prompt).toContain('boom')
    expect(prompt).toContain('50')
    expect(prompt).toContain('因果教训')
  })
})
