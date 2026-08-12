export type JsonChangeOrigin = 'action' | 'source' | 'tree'

export interface JsonHistoryState {
  future: string[]
  lastChangeAt: number
  lastOrigin: JsonChangeOrigin | null
  past: string[]
  text: string
}

export type JsonHistoryAction =
  | {
      origin: JsonChangeOrigin
      text: string
      timestamp: number
      type: 'change'
    }
  | { text: string; type: 'hydrate' }
  | { type: 'redo' }
  | { type: 'undo' }

const HISTORY_LIMIT = 50
const HISTORY_BYTE_LIMIT = 16 * 1024 * 1024
const LARGE_DOCUMENT_BYTES = 5 * 1024 * 1024
const EDIT_COALESCE_MS = 650

export const getUtf8Size = (value: string): number => new Blob([value]).size

export const createJsonHistory = (text = ''): JsonHistoryState => ({
  future: [],
  lastChangeAt: 0,
  lastOrigin: null,
  past: [],
  text,
})

const trimHistory = (entries: string[], currentText: string): string[] => {
  if (getUtf8Size(currentText) > LARGE_DOCUMENT_BYTES) {
    return entries.slice(-1)
  }

  const trimmed = entries.slice(-HISTORY_LIMIT)
  let totalSize = 0
  let startIndex = trimmed.length

  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    totalSize += getUtf8Size(trimmed[index])
    if (totalSize > HISTORY_BYTE_LIMIT) {
      break
    }
    startIndex = index
  }

  return trimmed.slice(startIndex)
}

export const jsonHistoryReducer = (
  state: JsonHistoryState,
  action: JsonHistoryAction
): JsonHistoryState => {
  if (action.type === 'hydrate') {
    return createJsonHistory(action.text)
  }

  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (previous === undefined) {
      return state
    }

    return {
      ...state,
      future: [...state.future, state.text],
      lastChangeAt: 0,
      lastOrigin: null,
      past: state.past.slice(0, -1),
      text: previous,
    }
  }

  if (action.type === 'redo') {
    const next = state.future.at(-1)
    if (next === undefined) {
      return state
    }

    return {
      ...state,
      future: state.future.slice(0, -1),
      lastChangeAt: 0,
      lastOrigin: null,
      past: trimHistory([...state.past, state.text], next),
      text: next,
    }
  }

  if (action.text === state.text) {
    return state
  }

  const shouldCoalesce =
    action.origin !== 'action' &&
    action.origin === state.lastOrigin &&
    action.timestamp - state.lastChangeAt <= EDIT_COALESCE_MS &&
    state.past.length > 0
  const past = shouldCoalesce
    ? state.past
    : trimHistory([...state.past, state.text], action.text)

  return {
    future: [],
    lastChangeAt: action.timestamp,
    lastOrigin: action.origin,
    past,
    text: action.text,
  }
}
