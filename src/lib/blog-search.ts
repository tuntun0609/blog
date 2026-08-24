interface BlogSearchDocument {
  category: string
  description?: string
  tags: readonly string[]
  title?: string
}

const SEARCH_TERM_SEPARATOR = /\s+/

const normalizeSearchText = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')

export const matchesBlogSearchQuery = (
  document: BlogSearchDocument,
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
      document.title,
      document.description,
      document.category,
      ...document.tags,
    ].join('\n')
  )

  return searchTerms.every((term) => searchableText.includes(term))
}
