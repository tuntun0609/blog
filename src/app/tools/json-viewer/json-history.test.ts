import { describe, expect, test } from 'bun:test'
import { createJsonHistory, jsonHistoryReducer } from './json-history'

describe('JSON document history', () => {
  test('coalesces nearby source edits into one undo step', () => {
    const first = jsonHistoryReducer(createJsonHistory(''), {
      origin: 'source',
      text: 'a',
      timestamp: 100,
      type: 'change',
    })
    const second = jsonHistoryReducer(first, {
      origin: 'source',
      text: 'ab',
      timestamp: 200,
      type: 'change',
    })
    const undone = jsonHistoryReducer(second, { type: 'undo' })

    expect(second.past).toEqual([''])
    expect(undone.text).toBe('')
  })

  test('keeps explicit actions as individual undo steps', () => {
    const first = jsonHistoryReducer(createJsonHistory('{}'), {
      origin: 'action',
      text: '{\n}',
      timestamp: 100,
      type: 'change',
    })
    const second = jsonHistoryReducer(first, {
      origin: 'action',
      text: '',
      timestamp: 120,
      type: 'change',
    })

    expect(jsonHistoryReducer(second, { type: 'undo' }).text).toBe('{\n}')
  })

  test('supports redo and clears redo after a new edit', () => {
    const changed = jsonHistoryReducer(createJsonHistory('{}'), {
      origin: 'tree',
      text: '{"ok":true}',
      timestamp: 100,
      type: 'change',
    })
    const undone = jsonHistoryReducer(changed, { type: 'undo' })
    const redone = jsonHistoryReducer(undone, { type: 'redo' })
    const replaced = jsonHistoryReducer(undone, {
      origin: 'action',
      text: '[]',
      timestamp: 200,
      type: 'change',
    })

    expect(redone.text).toBe('{"ok":true}')
    expect(replaced.future).toEqual([])
  })

  test('keeps only one snapshot for documents over five MiB', () => {
    const large = `"${'x'.repeat(5 * 1024 * 1024)}"`
    const first = jsonHistoryReducer(createJsonHistory(''), {
      origin: 'action',
      text: large,
      timestamp: 100,
      type: 'change',
    })
    const second = jsonHistoryReducer(first, {
      origin: 'action',
      text: `${large} `,
      timestamp: 200,
      type: 'change',
    })

    expect(second.past).toHaveLength(1)
    expect(second.past[0]).toBe(large)
  })
})
