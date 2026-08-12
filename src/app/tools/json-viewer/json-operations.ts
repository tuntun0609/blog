import { isLosslessNumber, parse, stringify } from 'lossless-json'
import type { JSONParser } from 'vanilla-jsoneditor'
import type {
  JsonOperationError,
  JsonParseResult,
  JsonPath,
  SearchResult,
} from './json-viewer-types'

export const JSON_INDENTATION = 2
export const SEARCH_RESULT_LIMIT = 1000

const POSITION_PATTERNS = [
  /(?:position|at)\s+(\d+)/iu,
  /char(?:acter)?\s+(\d+)/iu,
] as const
const IDENTIFIER_PATTERN = /^[A-Z_$][\w$]*$/iu

const normalizePosition = (value: number, text: string): number =>
  Math.min(Math.max(value, 0), text.length)

const getErrorPosition = (
  message: string,
  text: string
): number | undefined => {
  for (const pattern of POSITION_PATTERNS) {
    const match = pattern.exec(message)
    if (match?.[1]) {
      return normalizePosition(Number(match[1]), text)
    }
  }
}

export const getLineAndColumn = (
  text: string,
  position: number
): { column: number; line: number } => {
  const safePosition = normalizePosition(position, text)
  const beforeError = text.slice(0, safePosition)
  const lines = beforeError.split('\n')

  return {
    column: (lines.at(-1)?.length ?? 0) + 1,
    line: lines.length,
  }
}

export const normalizeJsonError = (
  error: unknown,
  text: string
): JsonOperationError => {
  const message = error instanceof Error ? error.message : 'JSON 处理失败。'
  const positionFromError =
    typeof error === 'object' &&
    error !== null &&
    'position' in error &&
    typeof error.position === 'number'
      ? error.position
      : undefined
  const position = positionFromError ?? getErrorPosition(message, text)

  if (position === undefined) {
    return { message }
  }

  return {
    ...getLineAndColumn(text, position),
    message,
    position,
  }
}

export const losslessJsonParser: JSONParser = {
  parse: (text: string): unknown => parse(text),
  stringify: (
    value: unknown,
    _replacer?:
      | ((this: unknown, key: string, value: unknown) => unknown)
      | Array<number | string>
      | null,
    space?: number | string
  ): string => stringify(value, null, space) ?? '',
}

export const parseJsonText = (text: string): JsonParseResult => {
  try {
    return { json: parse(text), ok: true }
  } catch (error) {
    return { error: normalizeJsonError(error, text), ok: false }
  }
}

export const formatJsonText = (
  text: string,
  indentation: number | string = JSON_INDENTATION
): string => {
  const json = parse(text)
  return stringify(json, null, indentation) ?? ''
}

export const formatJsonValue = (
  value: unknown,
  indentation: number | string = JSON_INDENTATION
): string => stringify(value, null, indentation) ?? ''

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getScalarPreview = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    value === null ||
    isLosslessNumber(value)
  ) {
    return String(value)
  }
  return ''
}

export const stringifyJsonPath = (path: JsonPath): string => {
  if (path.length === 0) {
    return '$'
  }

  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') {
      return `${result}[${segment}]`
    }

    if (IDENTIFIER_PATTERN.test(segment)) {
      return `${result}.${segment}`
    }

    return `${result}[${JSON.stringify(segment)}]`
  }, '$')
}

const addSearchResult = (
  results: SearchResult[],
  result: SearchResult,
  limit: number
): boolean => {
  if (results.length >= limit) {
    return false
  }
  results.push(result)
  return true
}

const addChildEntries = (
  stack: Array<{ path: JsonPath; value: unknown }>,
  item: { path: JsonPath; value: unknown },
  normalizedQuery: string,
  results: SearchResult[],
  limit: number
): boolean => {
  if (Array.isArray(item.value)) {
    for (let index = item.value.length - 1; index >= 0; index -= 1) {
      stack.push({ path: [...item.path, index], value: item.value[index] })
    }
    return true
  }

  if (!isRecord(item.value) || isLosslessNumber(item.value)) {
    return true
  }

  const entries = Object.entries(item.value)
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const [key, value] = entries[index]
    const path = [...item.path, key]
    if (
      key.toLocaleLowerCase().includes(normalizedQuery) &&
      !addSearchResult(results, { field: 'key', path, preview: key }, limit)
    ) {
      return false
    }
    stack.push({ path, value })
  }
  return true
}

export const searchJson = (
  json: unknown,
  query: string,
  limit = SEARCH_RESULT_LIMIT
): { results: SearchResult[]; truncated: boolean } => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return { results: [], truncated: false }
  }

  const results: SearchResult[] = []
  let truncated = false
  const stack: Array<{ path: JsonPath; value: unknown }> = [
    { path: [], value: json },
  ]

  while (stack.length > 0) {
    const item = stack.pop()
    if (!item) {
      break
    }

    const scalarPreview = getScalarPreview(item.value)
    if (
      scalarPreview.length > 0 &&
      scalarPreview.toLocaleLowerCase().includes(normalizedQuery) &&
      !addSearchResult(
        results,
        { field: 'value', path: item.path, preview: scalarPreview },
        limit
      )
    ) {
      truncated = true
      break
    }

    if (!addChildEntries(stack, item, normalizedQuery, results, limit)) {
      truncated = true
      break
    }
  }

  return { results, truncated }
}
