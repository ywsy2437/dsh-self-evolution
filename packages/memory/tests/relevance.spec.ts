import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Memory, { relevanceScore, tokenize } from '../src/index.ts'

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

describe('queryRelevantContradictions', () => {
  it('returns only fingerprints sharing a query token, ranked by overlap then recency', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    ctx.memory.recordFingerprint({
      type: 'gamma', triggerOp: 'finance', semanticLesson: '金融数据错误', causalChain: [],
    })
    const onTopic = ctx.memory.recordFingerprint({
      type: 'gamma', triggerOp: 'cordis_define', semanticLesson: '语法错误', causalChain: [],
    })

    const ranked = ctx.memory.queryRelevantContradictions('cordis 语法', 10, 'gamma')
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.id).toBe(onTopic.id)
  })

  it('returns nothing for a query with zero token overlap', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    ctx.memory.recordFingerprint({ type: 'gamma', triggerOp: 'cordis_define', semanticLesson: '语法错误', causalChain: [] })

    expect(ctx.memory.queryRelevantContradictions('金融数据 报表', 10, 'gamma')).toHaveLength(0)
  })

  it('filters below the minimum severity', async () => {
    const ctx = new Context()
    await ctx.plugin(Memory)

    ctx.memory.recordFingerprint({ type: 'alpha', triggerOp: 'a', semanticLesson: 'cordis 语法', causalChain: [] })
    ctx.memory.recordFingerprint({ type: 'gamma', triggerOp: 'g', semanticLesson: 'cordis 语法', causalChain: [] })

    const ranked = ctx.memory.queryRelevantContradictions('cordis 语法', 10, 'beta')
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.type).toBe('gamma')
  })
})
