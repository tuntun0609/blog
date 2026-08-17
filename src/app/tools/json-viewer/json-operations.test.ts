import { describe, expect, test } from 'bun:test'
import {
  formatJsonText,
  getLineAndColumn,
  parseJsonText,
} from './json-operations'

describe('JSON operations', () => {
  test('beautifies and minifies objects, arrays and Unicode values', () => {
    const input = '{"message":"你好","items":[1,null,true]}'
    const beautified = formatJsonText(input)

    expect(beautified).toContain('\n  "message": "你好"')
    expect(formatJsonText(beautified, 0)).toBe(input)
  })

  test('supports scalar roots', () => {
    expect(formatJsonText('null')).toBe('null')
    expect(formatJsonText('"hello"')).toBe('"hello"')
    expect(formatJsonText('42')).toBe('42')
  })

  test('preserves unsafe integers, exponents and decimal formatting', () => {
    const input = '{"long":9123372036854000123,"big":2.3e+500,"decimal":2.370}'
    const roundTrip = formatJsonText(formatJsonText(input), 0)

    expect(roundTrip).toBe(input)
  })

  test('rejects duplicate keys', () => {
    const result = parseJsonText('{"id":1,"id":2}')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message.toLowerCase()).toContain('duplicate')
    }
  })

  test('reports human readable line and column values', () => {
    expect(getLineAndColumn('{\n  "id": 1,\n}', 13)).toEqual({
      column: 1,
      line: 3,
    })
  })

  test('processes a document larger than ten MiB without losing panels data', () => {
    const payload = '数'.repeat(4 * 1024 * 1024)
    const input = `{"payload":"${payload}"}`
    const formatted = formatJsonText(input)
    const parsed = parseJsonText(formatted)

    expect(new Blob([input]).size).toBeGreaterThan(10 * 1024 * 1024)
    expect(parsed.ok).toBe(true)
    expect(formatJsonText(formatted, 0)).toBe(input)
  })
})
