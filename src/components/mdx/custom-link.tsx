import { AnchorHTMLAttributes } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

import type { LinkProps } from 'next/link'

const CustomLink = ({
  href,
  className,
  ...rest
}: LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const isInternalLink = href && href.startsWith('/')
  const isAnchorLink = href && href.startsWith('#')

  if (isInternalLink) {
    return <Link className={cn('break-words', className)} href={href} {...rest} />
  }

  if (isAnchorLink) {
    return <a className={cn('break-words', className)} href={href} {...rest} />
  }

  return (
    <a
      className={cn('break-words font-bold', className)}
      target="_blank"
      rel="noopener noreferrer"
      href={href}
      {...rest}
    />
  )
}

export default CustomLink
