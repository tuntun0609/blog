import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import type { BlogCategory } from '@/lib/blog-taxonomy'
import { getBlogListHref } from '@/lib/blog-url'
import { cn } from '@/lib/utils'
import styles from './blog.module.css'

interface BlogPaginationProps {
  activeCategory?: BlogCategory
  currentPage: number
  query?: string
  totalPages: number
}

interface BlogPageLinkProps {
  active?: boolean
  children: React.ReactNode
  href: string
  label: string
  size?: 'default' | 'icon'
}

function BlogPageLink({
  active = false,
  children,
  href,
  label,
  size = 'icon',
}: BlogPageLinkProps) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={cn(
        buttonVariants({ size, variant: active ? 'outline' : 'ghost' }),
        size === 'default' && 'px-3'
      )}
      data-active={active || undefined}
      href={href}
    >
      {children}
    </Link>
  )
}

export function BlogPagination({
  activeCategory,
  currentPage,
  query,
  totalPages,
}: BlogPaginationProps) {
  return (
    <Pagination className={styles.pagination}>
      <PaginationContent>
        {currentPage > 1 ? (
          <PaginationItem>
            <BlogPageLink
              href={getBlogListHref({
                category: activeCategory,
                page: currentPage - 1,
                query,
              })}
              label="前往上一页"
            >
              <ChevronLeftIcon aria-hidden="true" />
            </BlogPageLink>
          </PaginationItem>
        ) : null}
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <PaginationItem key={pageNumber}>
              <BlogPageLink
                active={pageNumber === currentPage}
                href={getBlogListHref({
                  category: activeCategory,
                  page: pageNumber,
                  query,
                })}
                label={`前往第 ${pageNumber} 页`}
              >
                {pageNumber}
              </BlogPageLink>
            </PaginationItem>
          )
        )}
        {currentPage < totalPages ? (
          <PaginationItem>
            <BlogPageLink
              href={getBlogListHref({
                category: activeCategory,
                page: currentPage + 1,
                query,
              })}
              label="前往下一页"
            >
              <ChevronRightIcon aria-hidden="true" />
            </BlogPageLink>
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  )
}
