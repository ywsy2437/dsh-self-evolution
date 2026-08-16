import { describe, expect, it } from 'vitest'
import { formatFingerprint } from '../src/index.ts'

describe('formatFingerprint', () => {
  it('marks unresolved fingerprints', () => {
    const line = formatFingerprint({ type: 'gamma', triggerOp: 'migrate_plugin', semanticLesson: '因为 A，导致 B', occurrenceCount: 3 })
    expect(line).toContain('[gamma] migrate_plugin (x3, 未解决)')
    expect(line).toContain('因为 A，导致 B')
  })

  it('marks resolved fingerprints with the patch id', () => {
    const line = formatFingerprint({ type: 'beta', triggerOp: 'config_update', semanticLesson: 'lesson', occurrenceCount: 1, resolvedBy: 'patch-1' })
    expect(line).toContain('(x1, 已解决(patch-1))')
  })
})
