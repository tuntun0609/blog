import { describe, expect, test } from 'bun:test'
import { jsonrepair } from 'jsonrepair'
import {
  formatJsonText,
  getLineAndColumn,
  parseJsonText,
  searchJson,
  stringifyJsonPath,
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

  test.each([
    ["{name: 'Ada'}", '{\n  "name": "Ada"\n}'],
    ['{"ok":true,}', '{\n  "ok": true\n}'],
    ['```json\n{"ok":true}\n```', '{\n  "ok": true\n}'],
    ['{"items":[1,2', '{\n  "items": [\n    1,\n    2\n  ]\n}'],
    [
      '{"id":1}\n{"id":2}',
      '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]',
    ],
  ])('repairs common malformed JSON: %s', (input, expected) => {
    expect(formatJsonText(jsonrepair(input))).toBe(expected)
  })

  test('throws when repair cannot infer a valid document', () => {
    expect(() => jsonrepair('}{}}{{')).toThrow()
  })

  test('searches keys and scalar values with stable paths', () => {
    const parsed = parseJsonText(
      '{"users":[{"display name":"Ada"},{"display name":"Lin"}]}'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const { results, truncated } = searchJson(parsed.json, 'ada')
    expect(truncated).toBe(false)
    expect(results).toEqual([
      {
        field: 'value',
        path: ['users', 0, 'display name'],
        preview: 'Ada',
      },
    ])
    expect(stringifyJsonPath(results[0].path)).toBe(
      '$.users[0]["display name"]'
    )
  })

  test('caps search result counts', () => {
    const { results, truncated } = searchJson(['a', 'a', 'a'], 'a', 2)
    expect(results).toHaveLength(2)
    expect(truncated).toBe(true)
  })

  test('processes a document larger than ten MiB without losing panels data', () => {
    const payload = '数'.repeat(4 * 1024 * 1024)
    const input = `{"payload":"${payload}"}`
    const formatted = formatJsonText(input)
    const parsed = parseJsonText(formatted)

    expect(new Blob([input]).size).toBeGreaterThan(10 * 1024 * 1024)
    expect(parsed.ok).toBe(true)
    expect(formatJsonText(formatted, 0)).toBe(input)
    if (parsed.ok) {
      expect(searchJson(parsed.json, '数数数', 1)).toEqual({
        results: [{ field: 'value', path: ['payload'], preview: payload }],
        truncated: false,
      })
    }
  })
})
