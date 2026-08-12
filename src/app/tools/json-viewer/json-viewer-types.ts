export type JsonPath = Array<number | string>

export interface JsonOperationError {
  column?: number
  line?: number
  message: string
  position?: number
}

export interface JsonParseSuccess {
  json: unknown
  ok: true
}

export interface JsonParseFailure {
  error: JsonOperationError
  ok: false
}

export type JsonParseResult = JsonParseFailure | JsonParseSuccess

export interface SearchResult {
  field: 'key' | 'value'
  path: JsonPath
  preview: string
}

export type JsonWorkerRequest =
  | {
      id: number
      text: string
      type: 'beautify' | 'minify' | 'repair'
    }
  | {
      id: number
      query: string
      text: string
      type: 'search'
    }

export type JsonWorkerSuccess =
  | {
      id: number
      ok: true
      text: string
      type: 'beautify' | 'minify' | 'repair'
    }
  | {
      id: number
      ok: true
      results: SearchResult[]
      truncated: boolean
      type: 'search'
    }

export interface JsonWorkerFailure {
  error: JsonOperationError
  id: number
  ok: false
  type: JsonWorkerRequest['type']
}

export type JsonWorkerResponse = JsonWorkerFailure | JsonWorkerSuccess
