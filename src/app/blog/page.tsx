import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogPagination } from '@/components/blog/blog-pagination'
import { PostCard } from '@/components/blog/post-card'
import { TagFilter } from '@/components/blog/tag-filter'
import {
  getPublishedPosts,
  getPublishedTagFacets,
  POSTS_PER_PAGE,
} from '@/lib/blog'
import styles from '@/components/blog/blog.module.css'

export const metadata: Metadata = {
  description: '来自开发札记的工程实践、技术观察与产品思考。',
  title: '博客',
}

interface BlogPageProps {
  searchParams: Promise<{
    page?: string | string[]
    tag?: string | string[]
  }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const posts = getPublishedPosts()
  const tags = getPublishedTagFacets()
  const { page, tag } = await searchParams
  const pageValue = Array.isArray(page) ? page[0] : page
  const tagValue = Array.isArray(tag) ? tag[0] : tag
  const activeTag = tagValue?.trim() || undefined

  if (activeTag && !tags.some((item) => item.name === activeTag)) {
    notFound()
  }

  const filteredPosts = activeTag
    ? posts.filter((post) => post.data.tags.includes(activeTag))
    : posts
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
  const categories = new Set(posts.map((post) => post.data.category)).size

  return (
    <div className={styles.listPage}>
      <header className={styles.listIntro}>
        <div>
          <p className={styles.kicker}>01 / WRITING</p>
          <h1 className={styles.listTitle}>开发札记</h1>
        </div>
        <div>
          <p className={styles.listLead}>
            记录前端工程、内容体验与产品构建中的具体问题，让实践成为可以继续使用的知识。
          </p>
          <dl className={styles.listSummary}>
            <div>
              <dt>已发布</dt>
              <dd>{posts.length} 篇文章</dd>
            </div>
            <div>
              <dt>主题</dt>
              <dd>{categories} 个方向</dd>
            </div>
          </dl>
        </div>
      </header>

      <TagFilter
        activeTag={activeTag}
        resultCount={filteredPosts.length}
        tags={tags}
        totalPosts={posts.length}
      />

      <section aria-label="文章列表" className={styles.postList}>
        {visiblePosts.map((post, index) => (
          <PostCard
            index={start + index + 1}
            key={post.url}
            post={post}
            preload={index === 0}
          />
        ))}
      </section>

      {totalPages > 1 ? (
        <BlogPagination
          activeTag={activeTag}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      ) : null}
    </div>
  )
}
