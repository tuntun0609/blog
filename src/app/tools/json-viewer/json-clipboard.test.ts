import { describe, expect, test } from 'bun:test'
import { copyTextWithFallback } from './json-clipboard'

describe('JSON clipboard adapter', () => {
  test('uses the modern Clipboard API when available', async () => {
    let written = ''
    let fallbackCalled = false

    await copyTextWithFallback(
      'hello',
      (value) => {
        written = value
        return Promise.resolve()
      },
      () => {
        fallbackCalled = true
        return true
      }
    )

    expect(written).toBe('hello')
    expect(fallbackCalled).toBe(false)
  })

  test('falls back when Clipboard API access is rejected', async () => {
    let fallbackValue = ''

    await copyTextWithFallback(
      'legacy',
      () => Promise.reject(new Error('denied')),
      (value) => {
        fallbackValue = value
        return true
      }
    )

    expect(fallbackValue).toBe('legacy')
  })

  test('reports failure when both copy strategies fail', async () => {
    await expect(
      copyTextWithFallback(
        'blocked',
        () => Promise.reject(new Error('denied')),
        () => false
      )
    ).rejects.toThrow('浏览器拒绝了复制操作。')
  })
})
