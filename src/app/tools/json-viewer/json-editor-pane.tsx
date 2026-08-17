'use client'

import {
  type Content,
  createJSONEditor,
  expandAll,
  type JsonEditor,
  Mode,
  type OnChangeStatus,
} from 'vanilla-jsoneditor'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'
import { losslessJsonParser } from './json-operations'

const MAX_TEXT_MODE_DOCUMENT_BYTES = 512 * 1024 * 1024

export interface JsonEditorPaneHandle {
  collapseAll: () => void
  expandAll: () => void
}

interface JsonEditorPaneProps {
  ariaLabel: string
  content: Content
  mode: 'text' | 'tree'
  onChange: (content: Content, status: OnChangeStatus) => void
  readOnly?: boolean
  ref?: Ref<JsonEditorPaneHandle>
  theme: 'dark' | 'light'
}

export function JsonEditorPane({
  ariaLabel,
  content,
  mode,
  onChange,
  readOnly = false,
  ref,
  theme,
}: JsonEditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<JsonEditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(
    ref,
    () => ({
      collapseAll: () => {
        editorRef.current?.collapse([], true)
      },
      expandAll: () => {
        editorRef.current?.expand([], expandAll)
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
          onChangeRef.current(nextContent, status)
        },
        onError: () => undefined,
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
