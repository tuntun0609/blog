export function getBlogListHref(page = 1, tag?: string): string {
  const searchParams = new URLSearchParams()

  if (tag) {
    searchParams.set('tag', tag)
  }

  if (page > 1) {
    searchParams.set('page', String(page))
  }

  const query = searchParams.toString()
  return query ? `/blog?${query}` : '/blog'
}
