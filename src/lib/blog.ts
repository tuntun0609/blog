import { posts } from 'collections/server'
import { loader } from 'fumadocs-core/source'

export const blogSource = loader({
  baseUrl: '/blog',
  source: posts.toFumadocsSource(),
})

export const POSTS_PER_PAGE = 6

export function getPublishedPosts() {
  return blogSource
    .getPages()
    .filter((post) => post.data.published)
    .sort((a, b) => Date.parse(b.data.date) - Date.parse(a.data.date))
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}
