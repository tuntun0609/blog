import { posts } from 'collections/server'
import { loader } from 'fumadocs-core/source'
import type { BlogTagFacet } from '@/lib/blog-types'

export const blogSource = loader({
  baseUrl: '/blog',
  source: posts.toFumadocsSource(),
})

export const POSTS_PER_PAGE = 20

const tagNameCollator = new Intl.Collator('zh-CN')

const publishedPosts = Object.freeze(
  blogSource
    .getPages()
    .filter((post) => post.data.published)
    .sort((a, b) => Date.parse(b.data.date) - Date.parse(a.data.date))
)

const tagFacets = Object.freeze(
  Array.from(
    publishedPosts.reduce((counts, post) => {
      for (const tag of new Set(post.data.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }

      return counts
    }, new Map<string, number>())
  )
    .map(([name, count]) => ({ count, name }))
    .sort(
      (a, b) => b.count - a.count || tagNameCollator.compare(a.name, b.name)
    )
)

export function getPublishedPosts() {
  return publishedPosts
}

export function getRecentPosts(limit: number) {
  return publishedPosts.slice(0, limit)
}

export function getPublishedTagFacets(): readonly BlogTagFacet[] {
  return tagFacets
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}
