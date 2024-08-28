'use client'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { usePage } from '@/lib/hook'
import { Blog } from 'contentlayer/generated'

export const BlogPagination = ({ blogs }: { blogs: Blog[] }) => {
  const { page, totalPage } = usePage({ total: blogs.length })

  if (totalPage === 1) {
    return null
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href={`/blog?page=${page - 1}`} />
        </PaginationItem>
        {Array.from({ length: totalPage }).map((_, idx) => (
          <PaginationItem key={idx}>
            <PaginationLink href={`/blog?page=${idx + 1}`} isActive={page === idx + 1}>
              {idx + 1}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href={`/blog?page=${page + 1}`} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
