export type DraftPersistenceResult =
  | 'cleared'
  | 'saved'
  | 'skipped'
  | 'unavailable'

export type DraftReadResult =
  | { status: 'idle'; text: '' }
  | { status: 'restored'; text: string }
  | { status: 'unavailable'; text: '' }

interface DraftStorage {
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
  setItem: (key: string, value: string) => void
}

export const readJsonDraft = (
  storage: DraftStorage,
  key: string
): DraftReadResult => {
  try {
    const text = storage.getItem(key) ?? ''
    return text ? { status: 'restored', text } : { status: 'idle', text: '' }
  } catch {
    return { status: 'unavailable', text: '' }
  }
}

export const persistJsonDraft = (
  storage: DraftStorage,
  key: string,
  text: string,
  byteSize: number,
  byteLimit: number
): DraftPersistenceResult => {
  try {
    if (!text) {
      storage.removeItem(key)
      return 'cleared'
    }

    if (byteSize > byteLimit) {
      storage.removeItem(key)
      return 'skipped'
    }

    storage.setItem(key, text)
    return 'saved'
  } catch {
    return 'unavailable'
  }
}

export const clearJsonDraft = (
  storage: DraftStorage,
  key: string
): DraftPersistenceResult => {
  try {
    storage.removeItem(key)
    return 'cleared'
  } catch {
    return 'unavailable'
  }
}
