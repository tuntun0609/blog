import { describe, expect, test } from 'bun:test'
import { clearJsonDraft, persistJsonDraft, readJsonDraft } from './json-draft'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const KEY = 'draft'

describe('JSON draft persistence', () => {
  test('saves, restores and clears a draft', () => {
    const storage = new MemoryStorage()

    expect(persistJsonDraft(storage, KEY, '{"ok":true}', 11, 100)).toBe('saved')
    expect(readJsonDraft(storage, KEY)).toEqual({
      status: 'restored',
      text: '{"ok":true}',
    })
    expect(clearJsonDraft(storage, KEY)).toBe('cleared')
    expect(readJsonDraft(storage, KEY)).toEqual({ status: 'idle', text: '' })
  })

  test('skips drafts over the byte limit and removes stale content', () => {
    const storage = new MemoryStorage()
    storage.setItem(KEY, 'stale')

    expect(persistJsonDraft(storage, KEY, 'large', 101, 100)).toBe('skipped')
    expect(storage.getItem(KEY)).toBeNull()
  })

  test('reports quota and storage access failures', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    }

    expect(readJsonDraft(unavailableStorage, KEY)).toEqual({
      status: 'unavailable',
      text: '',
    })
    expect(persistJsonDraft(unavailableStorage, KEY, '{}', 2, 100)).toBe(
      'unavailable'
    )
    expect(clearJsonDraft(unavailableStorage, KEY)).toBe('unavailable')
  })
})
