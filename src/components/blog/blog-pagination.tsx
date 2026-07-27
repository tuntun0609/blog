import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { getBlogListHref } from '@/lib/blog-url'
import styles from './blog.module.css'

interface BlogPaginationProps {
  activeTag?: string
  currentPage: number
  totalPages: number
}

export function BlogPagination({
  activeTag,
  currentPage,
  totalPages,
}: BlogPaginationProps) {
  return (
    <Pagination className={styles.pagination}>
      <PaginationContent>
        {currentPage > 1 ? (
          <PaginationItem>
            <PaginationPrevious
              href={getBlogListHref(currentPage - 1, activeTag)}
              text="上一页"
            />
          </PaginationItem>
        ) : null}
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href={getBlogListHref(pageNumber, activeTag)}
                isActive={pageNumber === currentPage}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        {currentPage < totalPages ? (
          <PaginationItem>
            <PaginationNext
              href={getBlogListHref(currentPage + 1, activeTag)}
              text="下一页"
            />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  )
}
