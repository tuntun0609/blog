import { posts } from 'collections/server'
import { loader } from 'fumadocs-core/source'
import { slugsFromData } from 'fumadocs-core/source/plugins/slugs'
import { BLOG_CATEGORIES, type BlogCategory } from '@/lib/blog-taxonomy'
import type { BlogCategoryFacet } from '@/lib/blog-types'

const BLOG_GITHUB_SOURCE_BASE_URL =
  'https://github.com/tuntun0609/blog/blob/master'

export const blogSource = loader({
  baseUrl: '/blog',
  slugs: slugsFromData('path'),
  source: posts.toFumadocsSource(),
})

export const POSTS_PER_PAGE = 20

const SEARCH_TERM_SEPARATOR = /\s+/

const publishedPosts = Object.freeze(
  blogSource
    .getPages()
    .filter((post) => post.data.published)
    .sort((a, b) => Date.parse(b.data.date) - Date.parse(a.data.date))
)

const categoryFacets = Object.freeze(
  BLOG_CATEGORIES.map((name) => ({
    count: publishedPosts.filter((post) => post.data.category === name).length,
    name,
  })) satisfies BlogCategoryFacet[]
)

interface PublishedPostFilters {
  category?: BlogCategory
  query?: string
}

const normalizeSearchText = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')

const matchesSearchQuery = (
  post: (typeof publishedPosts)[number],
  query: string
): boolean => {
  const searchTerms = normalizeSearchText(query)
    .split(SEARCH_TERM_SEPARATOR)
    .filter(Boolean)

  if (searchTerms.length === 0) {
    return true
  }

  const searchableText = normalizeSearchText(
    [
      post.data.title,
      post.data.description,
      post.data.category,
      ...post.data.tags,
    ].join('\n')
  )

  return searchTerms.every((term) => searchableText.includes(term))
}

export function getPublishedPosts() {
  return publishedPosts
}

export function getFilteredPublishedPosts({
  category,
  query,
}: PublishedPostFilters) {
  return publishedPosts.filter(
    (post) =>
      (!category || post.data.category === category) &&
      (!query || matchesSearchQuery(post, query))
  )
}

export async function getPostMarkdown(
  post: (typeof blogSource)['$inferPage']
): Promise<string> {
  const processedMarkdown = await post.data.getText('processed')

  return `# ${post.data.title}\n\n${post.data.description}\n\n${processedMarkdown.trim()}\n`
}

export function getPostGitHubUrl(
  post: (typeof blogSource)['$inferPage']
): string {
  const sourcePath = post.absolutePath ?? `content/blog/${post.path}`
  const encodedSourcePath = sourcePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return `${BLOG_GITHUB_SOURCE_BASE_URL}/${encodedSourcePath}`
}

export function getRecentPosts(limit: number) {
  return publishedPosts.slice(0, limit)
}

export function getPublishedCategoryFacets(): readonly BlogCategoryFacet[] {
  return categoryFacets
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}
