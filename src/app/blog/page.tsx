import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BlogIndex } from '@/components/blog/blog-index'
import {
  getFilteredPublishedPosts,
  getPublishedCategoryFacets,
  getPublishedPosts,
} from '@/lib/blog'
import { POSTS_PER_PAGE } from '@/lib/blog-constants'
import { isBlogCategory } from '@/lib/blog-taxonomy'
import type { BlogPostSummary } from '@/lib/blog-types'

export const metadata: Metadata = {
  authors: [{ name: 'Tuntun', url: 'https://github.com/tuntun0609' }],
  description: '分享前端、后端、AI 与工程实践中真实遇到的问题。',
  title: '文章',
}

const FEATURED_POST_URLS = [
  '/blog/production-agent-message-store',
  '/blog/video-convert-local-transcoder',
  '/blog/postgresql-quick-start',
] as const

interface BlogPageProps {
  searchParams: Promise<{
    category?: string | string[]
    page?: string | string[]
    q?: string | string[]
    tag?: string | string[]
  }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category, page, q, tag } = await searchParams
  if (tag !== undefined) {
    notFound()
  }

  const categoryValue = Array.isArray(category) ? category[0] : category
  const pageValue = Array.isArray(page) ? page[0] : page
  const queryValue = Array.isArray(q) ? q[0] : q
  const normalizedCategory = categoryValue?.trim()
  const activeQuery = queryValue?.trim() || undefined

  if (normalizedCategory && !isBlogCategory(normalizedCategory)) {
    notFound()
  }

  const activeCategory =
    normalizedCategory && isBlogCategory(normalizedCategory)
      ? normalizedCategory
      : undefined
  const categories = getPublishedCategoryFacets()
  const posts = getPublishedPosts().map(
    (post): BlogPostSummary => ({
      data: {
        category: post.data.category,
        cover: post.data.cover,
        date: post.data.date,
        description: post.data.description,
        tags: post.data.tags,
        title: post.data.title,
      },
      url: post.url,
    })
  )
  const filteredPosts = getFilteredPublishedPosts({
    category: activeCategory,
    query: activeQuery,
  })
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  )
  const currentPage = pageValue === undefined ? 1 : Number(pageValue)

  if (
    !Number.isInteger(currentPage) ||
    currentPage < 1 ||
    currentPage > totalPages
  ) {
    notFound()
  }

  const featuredPosts = FEATURED_POST_URLS.map((url) =>
    posts.find((post) => post.url === url)
  ).filter((post): post is BlogPostSummary => post !== undefined)

  return (
    <Suspense fallback={null}>
      <BlogIndex
        categories={categories}
        featuredPosts={featuredPosts}
        initialCategory={activeCategory}
        initialPage={currentPage}
        initialQuery={activeQuery}
        posts={posts}
      />
    </Suspense>
  )
}
