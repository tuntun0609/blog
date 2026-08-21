export const BLOG_CATEGORIES = [
  '前端开发',
  'AI',
  '后端开发',
  '工程实践',
] as const

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

const BLOG_CATEGORY_SET = new Set<string>(BLOG_CATEGORIES)

export const isBlogCategory = (value: string): value is BlogCategory =>
  BLOG_CATEGORY_SET.has(value)
