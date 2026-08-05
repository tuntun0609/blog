'use client'

import {
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const markdownCache = new Map<string, Promise<string>>()
const FEEDBACK_DURATION_MS = 1500

type CopyStatus = 'idle' | 'loading' | 'copied' | 'error'

const statusContent = {
  copied: {
    icon: CheckIcon,
    label: '已复制',
  },
  error: {
    icon: RotateCcwIcon,
    label: '重试复制',
  },
  idle: {
    icon: CopyIcon,
    label: '复制 Markdown',
  },
  loading: {
    icon: LoaderCircleIcon,
    label: '正在复制',
  },
} as const

interface CopyMarkdownButtonProps {
  markdownUrl: string
}

async function fetchMarkdown(markdownUrl: string): Promise<string> {
  let request = markdownCache.get(markdownUrl)

  if (!request) {
    request = fetch(markdownUrl).then((response) => {
      if (!response.ok) {
        throw new Error(`获取 Markdown 失败：${response.status}`)
      }

      return response.text()
    })
    markdownCache.set(markdownUrl, request)
  }

  try {
    return await request
  } catch (error) {
    markdownCache.delete(markdownUrl)
    throw error
  }
}

export function CopyMarkdownButton({ markdownUrl }: CopyMarkdownButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const resetTimerRef = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      if (resetTimerRef.current !== undefined) {
        window.clearTimeout(resetTimerRef.current)
      }
    },
    []
  )

  const resetStatusLater = useCallback(() => {
    if (resetTimerRef.current !== undefined) {
      window.clearTimeout(resetTimerRef.current)
    }

    resetTimerRef.current = window.setTimeout(() => {
      setStatus('idle')
      resetTimerRef.current = undefined
    }, FEEDBACK_DURATION_MS)
  }, [])

  const copyMarkdown = useCallback(async () => {
    setStatus('loading')

    try {
      const markdown = await fetchMarkdown(markdownUrl)
      await navigator.clipboard.writeText(markdown)
      setStatus('copied')
    } catch {
      setStatus('error')
    } finally {
      resetStatusLater()
    }
  }, [markdownUrl, resetStatusLater])

  const { icon: StatusIcon, label } = statusContent[status]

  return (
    <Button
      aria-label={label}
      disabled={status === 'loading'}
      onClick={copyMarkdown}
      size="sm"
      title={label}
      type="button"
      variant="secondary"
    >
      <StatusIcon
        aria-hidden="true"
        className={status === 'loading' ? 'animate-spin' : undefined}
        data-icon="inline-start"
      />
      <span aria-live="polite">{label}</span>
    </Button>
  )
}
