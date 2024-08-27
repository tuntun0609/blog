import { cn } from '@/lib/utils'

import CustomLink from './custom-link'
import Image from './image'

import type { MDXComponents } from 'mdx/types'

const MDXComponents: MDXComponents = {
  h1: props => <h1 {...props} className={cn('mb-4 mt-6 text-4xl font-bold', props.className)} />,
  h2: props => (
    <h2
      {...props}
      className={cn('mb-4 mt-6 border-gray-200 pb-2 text-3xl font-semibold', props.className)}
    />
  ),
  h3: props => (
    <h3 {...props} className={cn('mb-4 mt-6 text-2xl font-semibold', props.className)} />
  ),
  h4: props => <h4 {...props} className={cn('mb-4 mt-6 text-xl font-semibold', props.className)} />,
  h5: props => <h5 {...props} className={cn('mb-4 mt-6 text-lg font-semibold', props.className)} />,
  h6: props => (
    <h6 {...props} className={cn('mb-4 mt-6 text-base font-semibold', props.className)} />
  ),
  p: props => <p {...props} className={cn('mb-4 mt-0', props.className)} />,
  a: props => (
    <CustomLink
      {...props}
      href={props.href ?? ''}
      className={cn('text-blue-600 underline', props.className)}
    />
  ),
  ul: props => <ul {...props} className={cn('mb-4 mt-0 list-disc pl-5', props.className)} />,
  ol: props => <ol {...props} className={cn('mb-4 mt-0 list-decimal pl-5', props.className)} />,
  li: props => <li {...props} className={cn('mb-2', props.className)} />,
  code: props => (
    <code {...props} className={cn('rounded bg-gray-600 px-1 text-white', props.className)} />
  ),
  pre: props => (
    <pre
      {...props}
      className={cn('mb-4 overflow-x-auto rounded bg-gray-600 p-4', props.className)}
    />
  ),
  blockquote: props => (
    <blockquote
      {...props}
      className={cn(
        'my-4 border-l-4 border-gray-200 pl-4 italic text-gray-400 dark:text-gray-300',
        props.className
      )}
      {...props}
    />
  ),
  Image,
}

export default MDXComponents
