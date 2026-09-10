import { describe, expect, it } from 'vitest'
import { translations } from '../translations'

describe('translations', () => {
  it('has the exact same set of keys in es and en (no drift between locales)', () => {
    const esKeys = Object.keys(translations.es).sort()
    const enKeys = Object.keys(translations.en).sort()
    expect(enKeys).toEqual(esKeys)
  })

})
