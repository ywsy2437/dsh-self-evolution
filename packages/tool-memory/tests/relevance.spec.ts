import { describe, expect, it } from 'vitest'
import { relevanceScore, tokenize } from '../src/index.ts'

describe('tokenize', () => {
  it('splits ASCII words and individual CJK characters', () => {
    const tokens = tokenize('cordis_define 语法 错误')
    expect(tokens.has('cordis')).toBe(true)
    expect(tokens.has('define')).toBe(true)
    expect(tokens.has('语')).toBe(true)
    expect(tokens.has('法')).toBe(true)
    expect(tokens.has('错')).toBe(true)
  })
})

describe('relevanceScore', () => {
  it('scores 1 when every query token is present', () => {
    expect(relevanceScore('cordis 语法', 'cordis_define 语法错误')).toBe(1)
  })

  it('scores 0 when no query token is present', () => {
    expect(relevanceScore('金融 数据', 'cordis_define 语法错误')).toBe(0)
  })

  it('scores the fraction of query tokens present', () => {
    expect(relevanceScore('cordis 金', 'cordis_define 语法错误')).toBe(0.5)
  })

  it('scores 0 for an empty query', () => {
    expect(relevanceScore('', 'anything')).toBe(0)
  })
})
