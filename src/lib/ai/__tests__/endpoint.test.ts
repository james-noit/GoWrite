import { describe, expect, it } from 'vitest'
import { customChatCompletionsUrl, customModelsUrl } from '../endpoint'

describe('customChatCompletionsUrl', () => {
  it('appends /v1/chat/completions to a bare base URL', () => {
    expect(customChatCompletionsUrl('http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234/v1/chat/completions')
  })

  it('ignores any path the user already typed, keeping only the origin', () => {
    expect(customChatCompletionsUrl('http://127.0.0.1:1234/v1/completions')).toBe(
      'http://127.0.0.1:1234/v1/chat/completions',
    )
    expect(customChatCompletionsUrl('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1/chat/completions')
    expect(customChatCompletionsUrl('http://127.0.0.1:1234/')).toBe('http://127.0.0.1:1234/v1/chat/completions')
  })

  it('trims surrounding whitespace', () => {
    expect(customChatCompletionsUrl('  http://localhost:11434  ')).toBe(
      'http://localhost:11434/v1/chat/completions',
    )
  })
})

describe('customModelsUrl', () => {
  it('appends /v1/models to the origin only', () => {
    expect(customModelsUrl('http://127.0.0.1:1234/v1/chat/completions')).toBe('http://127.0.0.1:1234/v1/models')
  })
})
