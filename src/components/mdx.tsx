import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'

import { CodeBlock, Pre } from '@/components/blog/code-block'

export function getMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    a: ({ href = '', ...props }) =>
      href.startsWith('/') ? (
        <Link
          className="font-medium text-primary underline underline-offset-4"
          href={href}
          {...props}
        />
      ) : (
        <a
          className="font-medium text-primary underline underline-offset-4"
          href={href}
          rel="noreferrer"
          target="_blank"
          {...props}
        />
      ),
    blockquote: (props) => (
      <blockquote
        className="mt-6 border-l-2 pl-5 text-muted-foreground italic"
        {...props}
      />
    ),
    code: (props) => (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="mt-12 scroll-mt-24 font-semibold text-2xl leading-9"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-8 scroll-mt-24 font-semibold text-xl leading-8"
        {...props}
      />
    ),
    li: (props) => <li className="pl-1 leading-7" {...props} />,
    ol: (props) => (
      <ol className="mt-5 flex list-decimal flex-col gap-2 pl-6" {...props} />
    ),
    p: (props) => <p className="mt-5 text-base leading-8" {...props} />,
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ul: (props) => (
      <ul className="mt-5 flex list-disc flex-col gap-2 pl-6" {...props} />
    ),
    ...components,
  }
}
