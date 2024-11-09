interface DocSearchSiteConfig {
  docSearch: {
    appId: string
    indexName: string
    apiKey: string
  }
}

export const docSearchConfig: DocSearchSiteConfig = {
  docSearch: {
    appId: process.env.NEXT_PUBLIC_DOCSEARCH_APP_ID!,
    indexName: process.env.NEXT_PUBLIC_DOCSEARCH_INDEX_NAME!,
    apiKey: process.env.NEXT_PUBLIC_DOCSEARCH_API_KEY!,
  },
}
