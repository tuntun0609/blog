/// <reference lib="webworker" />

import {
  formatJsonText,
  normalizeJsonError,
  parseJsonText,
  searchJson,
} from './json-operations'
import type { JsonWorkerRequest, JsonWorkerResponse } from './json-viewer-types'

const handleRequest = (request: JsonWorkerRequest): JsonWorkerResponse => {
  try {
    if (request.type === 'beautify') {
      return {
        id: request.id,
        ok: true,
        text: formatJsonText(request.text),
        type: request.type,
      }
    }

    if (request.type === 'minify') {
      return {
        id: request.id,
        ok: true,
        text: formatJsonText(request.text, 0),
        type: request.type,
      }
    }

    if (!('query' in request)) {
      return {
        error: { message: '无法识别 JSON 操作。' },
        id: request.id,
        ok: false,
        type: request.type,
      }
    }

    const parsed = parseJsonText(request.text)
    if (!parsed.ok) {
      return {
        error: parsed.error,
        id: request.id,
        ok: false,
        type: request.type,
      }
    }

    const search = searchJson(parsed.json, request.query)
    return {
      id: request.id,
      ok: true,
      results: search.results,
      truncated: search.truncated,
      type: request.type,
    }
  } catch (error) {
    return {
      error: normalizeJsonError(error, request.text),
      id: request.id,
      ok: false,
      type: request.type,
    }
  }
}

self.addEventListener('message', (event: MessageEvent<JsonWorkerRequest>) => {
  self.postMessage(handleRequest(event.data))
})
