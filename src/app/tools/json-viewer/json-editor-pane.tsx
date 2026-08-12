'use client'

import {
  type Content,
  createJSONEditor,
  createKeySelection,
  createValueSelection,
  expandAll,
  type JsonEditor,
  Mode,
  type OnChangeStatus,
  type OnSelect,
} from 'vanilla-jsoneditor'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'
import { losslessJsonParser } from './json-operations'
import type { JsonPath } from './json-viewer-types'

type EditorJsonPath = string[]
const MAX_TEXT_MODE_DOCUMENT_BYTES = 512 * 1024 * 1024

export interface JsonEditorPaneHandle {
  collapseAll: () => void
  expandAll: () => void
  focusPath: (path: JsonPath, field: 'key' | 'value') => Promise<void>
}

interface JsonEditorPaneProps {
  ariaLabel: string
  content: Content
  mode: 'text' | 'tree'
  onChange: (content: Content, status: OnChangeStatus) => void
  onSelect?: OnSelect
  readOnly?: boolean
  ref?: Ref<JsonEditorPaneHandle>
  theme: 'dark' | 'light'
}

const isPathPrefix = (
  candidate: EditorJsonPath,
  path: EditorJsonPath
): boolean => candidate.every((segment, index) => path[index] === segment)

export function JsonEditorPane({
  ariaLabel,
  content,
  mode,
  onChange,
  onSelect,
  readOnly = false,
  ref,
  theme,
}: JsonEditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<JsonEditor | null>(null)
  const callbacksRef = useRef({ onChange, onSelect })
  callbacksRef.current = { onChange, onSelect }

  useImperativeHandle(
    ref,
    () => ({
      collapseAll: () => {
        editorRef.current?.collapse([], true)
      },
      expandAll: () => {
        editorRef.current?.expand([], expandAll)
      },
      focusPath: async (path, field) => {
        const editor = editorRef.current
        if (!editor) {
          return
        }

        const editorPath = path.map(String)
        editor.expand([], (relativePath) =>
          isPathPrefix(relativePath, editorPath)
        )
        editor.select(
          field === 'key'
            ? createKeySelection(editorPath)
            : createValueSelection(editorPath)
        )
        await editor.scrollTo(editorPath)
        editor.focus()
      },
    }),
    []
  )

  useEffect(() => {
    const target = containerRef.current
    if (!target) {
      return
    }

    const editor = createJSONEditor({
      props: {
        ariaLabel,
        askToFormat: false,
        content,
        indentation: 2,
        mainMenuBar: false,
        maxDocumentSizeTextMode: MAX_TEXT_MODE_DOCUMENT_BYTES,
        mode: mode === 'text' ? Mode.text : Mode.tree,
        navigationBar: false,
        onChange: (
          nextContent: Content,
          _previousContent: Content,
          status: OnChangeStatus
        ) => {
          callbacksRef.current.onChange(nextContent, status)
        },
        onError: () => undefined,
        onSelect: (selection: Parameters<NonNullable<OnSelect>>[0]) =>
          callbacksRef.current.onSelect?.(selection),
        parser: losslessJsonParser,
        readOnly,
        statusBar: false,
        tabSize: 2,
        truncateTextSize: 2000,
        validationParser: losslessJsonParser,
      },
      target,
    })
    editorRef.current = editor

    return () => {
      editorRef.current = null
      editor.destroy().catch(() => undefined)
    }
  }, [ariaLabel, mode])

  useEffect(() => {
    editorRef.current?.updateProps({
      content,
      parser: losslessJsonParser,
      readOnly,
      validationParser: losslessJsonParser,
    })
  }, [content, readOnly])

  return (
    <div
      className={
        theme === 'dark'
          ? 'json-viewer-editor jse-theme-dark'
          : 'json-viewer-editor'
      }
      ref={containerRef}
    />
  )
}
