import type { BlogCategory } from '@/lib/blog-taxonomy'

interface BlogListHrefOptions {
  category?: BlogCategory
  page?: number
  query?: string
}

export function getBlogListHref({
  category,
  page = 1,
  query,
}: BlogListHrefOptions = {}): string {
  const searchParams = new URLSearchParams()

  if (category) {
    searchParams.set('category', category)
  }

  const normalizedQuery = query?.trim()
  if (normalizedQuery) {
    searchParams.set('q', normalizedQuery)
  }

  if (page > 1) {
    searchParams.set('page', String(page))
  }

  const queryString = searchParams.toString()
  return queryString ? `/blog?${queryString}` : '/blog'
}
