'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import {
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CodeBlockProps = Omit<ComponentProps<'figure'>, 'title'> & {
  title?: ReactNode
  icon?: ReactNode
  viewportProps?: HTMLAttributes<HTMLDivElement>
  'data-line-numbers'?: boolean
  'data-line-numbers-start'?: number
}

export function Pre({ className, ...props }: ComponentProps<'pre'>) {
  return (
    <pre
      className={cn(
        'w-max min-w-full font-mono [&>code]:flex [&>code]:flex-col [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[length:inherit]',
        className
      )}
      {...props}
    />
  )
}

export function CodeBlock({
  ref,
  title,
  children,
  icon: _icon,
  className,
  style,
  viewportProps = {},
  'data-line-numbers': lineNumbers,
  'data-line-numbers-start': lineNumbersStart = 1,
  ...props
}: CodeBlockProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const copyCode = useCallback(async () => {
    const code = viewportRef.current?.querySelector('pre')?.textContent
    if (!code) {
      return
    }

    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [])

  return (
    <figure
      dir="ltr"
      ref={ref}
      {...props}
      className={cn(
        'blog-code-block relative my-6 overflow-hidden rounded-lg border bg-code-block text-sm shadow-sm',
        className
      )}
      data-has-title={title ? '' : undefined}
      data-line-numbers={lineNumbers || undefined}
      data-line-numbers-start={lineNumbers ? lineNumbersStart : undefined}
      style={{
        ...style,
        counterSet: lineNumbers ? `line ${lineNumbersStart - 1}` : undefined,
      }}
      tabIndex={-1}
    >
      {title ? (
        <div className="flex h-10 items-center gap-2 border-b bg-muted/70 px-4 text-muted-foreground">
          <figcaption className="min-w-0 flex-1 truncate font-mono text-xs">
            {title}
          </figcaption>
          <CopyButton copied={copied} onClick={copyCode} />
        </div>
      ) : (
        <CopyButton
          className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm"
          copied={copied}
          onClick={copyCode}
        />
      )}

      <section
        ref={viewportRef}
        {...viewportProps}
        aria-label={typeof title === 'string' ? title : '代码块'}
        className={cn(
          'max-h-[600px] overflow-auto py-4 text-[0.8125rem] leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          viewportProps.className
        )}
      >
        {children}
      </section>
    </figure>
  )
}

function CopyButton({
  copied,
  className,
  ...props
}: ComponentProps<typeof Button> & { copied: boolean }) {
  return (
    <Button
      aria-label={copied ? '已复制代码' : '复制代码'}
      className={className}
      size="icon-sm"
      title={copied ? '已复制' : '复制代码'}
      type="button"
      variant="ghost"
      {...props}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}
