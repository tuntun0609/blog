'use client'

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from 'lucide-react'
import type { ComponentProps, ComponentType } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GitHubIcon } from '@/components/github-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

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

type MenuIcon = ComponentType<ComponentProps<'svg'>>

interface OpenItem {
  href: string
  icon: MenuIcon
  label: string
}

interface ArticlePageActionsProps {
  githubUrl: string
  markdownUrl: string
  pageUrl: string
}

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

function CopyMarkdownButton({ markdownUrl }: CopyMarkdownButtonProps) {
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
      size="lg"
      title={label}
      type="button"
      variant="secondary"
    >
      <StatusIcon
        aria-hidden="true"
        className={cn(status === 'loading' && 'animate-spin')}
        data-icon="inline-start"
      />
      <span aria-live="polite">{label}</span>
    </Button>
  )
}

function SciraIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 910 934"
    >
      <path
        d="M647.664 197.775C569.13 189.049 525.5 145.419 516.774 66.8849C508.048 145.419 464.418 189.049 385.884 197.775C464.418 206.501 508.048 250.131 516.774 328.665C525.5 250.131 569.13 206.501 647.664 197.775Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M857.5 508.116C763.259 497.644 710.903 445.288 700.432 351.047C689.961 445.288 637.605 497.644 543.364 508.116C637.605 518.587 689.961 570.943 700.432 665.184C710.903 570.943 763.259 518.587 857.5 508.116Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="20"
      />
      <path
        d="M889.949 121.237C831.049 114.692 798.326 81.9698 791.782 23.0692C785.237 81.9698 752.515 114.692 693.614 121.237C752.515 127.781 785.237 160.504 791.782 219.404C798.326 160.504 831.049 127.781 889.949 121.237Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M760.632 764.337C720.719 814.616 669.835 855.1 611.872 882.692C553.91 910.285 490.404 924.255 426.213 923.533C362.022 922.812 298.846 907.419 241.518 878.531C184.19 849.643 134.228 808.026 95.4548 756.863C56.6815 705.7 30.1238 646.346 17.8129 583.343C5.50207 520.339 7.76433 455.354 24.4266 393.359C41.089 331.364 71.7099 274.001 113.947 225.658C156.184 177.315 208.919 139.273 268.117 114.442"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="30"
      />
    </svg>
  )
}

function OpenAIIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  )
}

function AnthropicIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  )
}

function CursorIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  )
}

function getOpenItems({
  githubUrl,
  markdownUrl,
  pageUrl,
}: ArticlePageActionsProps): OpenItem[] {
  const question = `请阅读 ${pageUrl}，我想就这篇文章提问。`

  return [
    {
      href: githubUrl,
      icon: GitHubIcon,
      label: '在 GitHub 中打开',
    },
    {
      href: markdownUrl,
      icon: FileTextIcon,
      label: '以 Markdown 查看',
    },
    {
      href: `https://scira.ai/?${new URLSearchParams({ q: question })}`,
      icon: SciraIcon,
      label: '在 Scira AI 中打开',
    },
    {
      href: `https://chatgpt.com/?${new URLSearchParams({
        hints: 'search',
        prompt: question,
      })}`,
      icon: OpenAIIcon,
      label: '在 ChatGPT 中打开',
    },
    {
      href: `https://claude.ai/new?${new URLSearchParams({ q: question })}`,
      icon: AnthropicIcon,
      label: '在 Claude 中打开',
    },
    {
      href: `https://cursor.com/link/prompt?${new URLSearchParams({
        text: question,
      })}`,
      icon: CursorIcon,
      label: '在 Cursor 中打开',
    },
  ]
}

export function ArticlePageActions(props: ArticlePageActionsProps) {
  const openItems = getOpenItems(props)

  return (
    <>
      <CopyMarkdownButton markdownUrl={props.markdownUrl} />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="打开文章的其他阅读方式"
          render={<Button size="lg" type="button" variant="secondary" />}
        >
          打开
          <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          aria-label="文章打开方式"
          className="min-w-64"
          sideOffset={8}
        >
          <DropdownMenuGroup>
            {openItems.map(({ href, icon: ItemIcon, label }) => (
              <DropdownMenuItem
                className="min-h-10"
                key={href}
                render={
                  <a href={href} rel="noreferrer noopener" target="_blank" />
                }
              >
                <ItemIcon aria-hidden="true" />
                <span>{label}</span>
                <ExternalLinkIcon
                  aria-hidden="true"
                  className="ml-auto text-muted-foreground"
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
