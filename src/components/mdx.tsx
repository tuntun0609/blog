import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export function getMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    h2: (props) => (
      <h2
        className="mt-12 scroll-mt-24 text-2xl font-semibold leading-9"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-8 scroll-mt-24 text-xl font-semibold leading-8"
        {...props}
      />
    ),
    p: (props) => <p className="mt-5 text-base leading-8" {...props} />,
    a: ({ href = "", ...props }) =>
      href.startsWith("/") ? (
        <Link
          href={href}
          className="font-medium text-primary underline underline-offset-4"
          {...props}
        />
      ) : (
        <a
          href={href}
          className="font-medium text-primary underline underline-offset-4"
          rel="noreferrer"
          target="_blank"
          {...props}
        />
      ),
    ul: (props) => (
      <ul className="mt-5 flex list-disc flex-col gap-2 pl-6" {...props} />
    ),
    ol: (props) => (
      <ol className="mt-5 flex list-decimal flex-col gap-2 pl-6" {...props} />
    ),
    li: (props) => <li className="pl-1 leading-7" {...props} />,
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
    pre: (props) => (
      <pre
        className="mt-6 overflow-x-auto rounded-lg bg-muted p-5 text-sm leading-7 [&_code]:bg-transparent [&_code]:p-0"
        {...props}
      />
    ),
    ...components,
  };
}
