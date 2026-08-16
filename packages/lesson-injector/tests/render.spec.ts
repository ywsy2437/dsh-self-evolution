import { describe, expect, it } from 'vitest'
import { renderLessons } from '../src/index.ts'

describe('renderLessons', () => {
  it('renders nothing for an empty lesson set', () => {
    expect(renderLessons([])).toBe('')
  })

  it('renders a forced-reflection block with indexed lessons and occurrence counts', () => {
    const text = renderLessons([
      { semanticLesson: '因为 A，导致 B，下次应该 C', occurrenceCount: 2 },
      { semanticLesson: '因为 X，导致 Y，下次应该 Z', occurrenceCount: 1 },
    ])
    expect(text).toContain('【系统强制反思】')
    expect(text).toContain('[教训1] 因为 A，导致 B，下次应该 C (发生次数: 2)')
    expect(text).toContain('[教训2] 因为 X，导致 Y，下次应该 Z (发生次数: 1)')
    expect(text).toContain('你最近的 2 次自修改操作引发了运行时矛盾')
  })
})
