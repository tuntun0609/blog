'use client'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface BlogPaginationProps {
  currentPage: number
  totalPages: number
}

function pageHref(page: number) {
  return page === 1 ? '/blog' : `/blog?page=${page}`
}

export function BlogPagination({
  currentPage,
  totalPages,
}: BlogPaginationProps) {
  return (
    <Pagination className="mt-12">
      <PaginationContent>
        {currentPage > 1 ? (
          <PaginationItem>
            <PaginationPrevious
              href={pageHref(currentPage - 1)}
              text="上一页"
            />
          </PaginationItem>
        ) : null}
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href={pageHref(pageNumber)}
                isActive={pageNumber === currentPage}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        {currentPage < totalPages ? (
          <PaginationItem>
            <PaginationNext href={pageHref(currentPage + 1)} text="下一页" />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  )
}
