import type { BlogCategory } from '@/lib/blog-taxonomy'

export interface BlogCategoryFacet {
  count: number
  name: BlogCategory
}

export interface BlogPostSummary {
  data: {
    category: BlogCategory
    cover: string
    date: string
    description?: string
    tags: string[]
    title?: string
  }
  url: string
}
