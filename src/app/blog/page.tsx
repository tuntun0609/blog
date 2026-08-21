import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogPagination } from '@/components/blog/blog-pagination'
import { CategoryFilter } from '@/components/blog/category-filter'
import { PostCard } from '@/components/blog/post-card'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  getFilteredPublishedPosts,
  getPublishedCategoryFacets,
  POSTS_PER_PAGE,
} from '@/lib/blog'
import { BLOG_CATEGORIES, isBlogCategory } from '@/lib/blog-taxonomy'
import styles from '@/components/blog/blog.module.css'

export const metadata: Metadata = {
  description: '工程实践、技术观察与产品思考。',
  title: '博客',
}

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
  const totalPosts = categories.reduce(
    (total, categoryFacet) => total + categoryFacet.count,
    0
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

  const start = (currentPage - 1) * POSTS_PER_PAGE
  const visiblePosts = filteredPosts.slice(start, start + POSTS_PER_PAGE)

  return (
    <div className={styles.listPage}>
      <header className={styles.listIntro}>
        <div>
          <h1 className={styles.listTitle}>文章</h1>
        </div>
        <div>
          <p className={styles.listLead}>
            记录前端工程、内容体验与产品构建中的具体问题，让实践成为可以继续使用的知识。
          </p>
          <dl className={styles.listSummary}>
            <div>
              <dt>已发布</dt>
              <dd>{totalPosts} 篇文章</dd>
            </div>
            <div>
              <dt>分类</dt>
              <dd>{BLOG_CATEGORIES.length} 个分类</dd>
            </div>
          </dl>
        </div>
      </header>

      <CategoryFilter
        activeCategory={activeCategory}
        categories={categories}
        query={activeQuery}
        resultCount={filteredPosts.length}
        totalPosts={totalPosts}
      />

      <section aria-label="文章列表" className={styles.postList}>
        {visiblePosts.length > 0 ? (
          visiblePosts.map((post, index) => (
            <PostCard key={post.url} post={post} preload={index === 0} />
          ))
        ) : (
          <Empty className={styles.searchEmpty}>
            <EmptyHeader>
              <EmptyTitle>没有找到相关文章</EmptyTitle>
              <EmptyDescription>
                换一个关键词，或者清除分类后查看全部文章。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link href="/blog" />}
                variant="outline"
              >
                查看全部文章
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>

      {totalPages > 1 ? (
        <BlogPagination
          activeCategory={activeCategory}
          currentPage={currentPage}
          query={activeQuery}
          totalPages={totalPages}
        />
      ) : null}
    </div>
  )
}
