'use client'

import { ArrowUpRightIcon, MailIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BlogHero } from '@/components/blog/blog-hero'
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
import { POSTS_PER_PAGE } from '@/lib/blog-constants'
import { matchesBlogSearchQuery } from '@/lib/blog-search'
import { type BlogCategory, isBlogCategory } from '@/lib/blog-taxonomy'
import type { BlogCategoryFacet, BlogPostSummary } from '@/lib/blog-types'
import { getBlogListHref } from '@/lib/blog-url'
import styles from './blog.module.css'

interface BlogIndexProps {
  categories: readonly BlogCategoryFacet[]
  featuredPosts: readonly BlogPostSummary[]
  initialCategory?: BlogCategory
  initialPage: number
  initialQuery?: string
  posts: readonly BlogPostSummary[]
}

const getPageValue = (value: string | null): number => {
  if (value === null) {
    return 1
  }

  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function BlogIndex({
  categories,
  featuredPosts,
  initialCategory,
  initialPage,
  initialQuery,
  posts,
}: BlogIndexProps) {
  const [queryInput, setQueryInput] = useState(initialQuery ?? '')
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [currentPage, setCurrentPage] = useState(initialPage)

  useEffect(() => {
    setActiveCategory(initialCategory)
    setCurrentPage(initialPage)
    setQueryInput(initialQuery ?? '')
  }, [initialCategory, initialPage, initialQuery])

  useEffect(() => {
    const syncStateFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const categoryValue = params.get('category')
      const nextCategory =
        categoryValue && isBlogCategory(categoryValue)
          ? categoryValue
          : undefined
      const nextPage = getPageValue(params.get('page'))
      const nextQuery = params.get('q')?.trim() ?? ''

      setActiveCategory(nextCategory)
      setCurrentPage(nextPage)
      setQueryInput(nextQuery)
    }

    window.addEventListener('popstate', syncStateFromUrl)
    return () => window.removeEventListener('popstate', syncStateFromUrl)
  }, [])

  const activeQuery = queryInput.trim()
  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          (!activeCategory || post.data.category === activeCategory) &&
          (!activeQuery || matchesBlogSearchQuery(post.data, activeQuery))
      ),
    [activeCategory, activeQuery, posts]
  )
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  )
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * POSTS_PER_PAGE
  const visiblePosts = filteredPosts.slice(start, start + POSTS_PER_PAGE)
  const isFiltered = Boolean(activeCategory || activeQuery || safePage > 1)

  const updateUrl = useCallback(
    (
      nextState: {
        category?: BlogCategory
        page?: number
        query?: string
      },
      historyMode: 'push' | 'replace'
    ) => {
      const href = getBlogListHref(nextState)
      const historyMethod =
        historyMode === 'push' ? 'pushState' : 'replaceState'

      window.history[historyMethod](null, '', href)
    },
    []
  )

  const handleCategoryChange = useCallback(
    (category?: BlogCategory) => {
      setActiveCategory(category)
      setCurrentPage(1)
      updateUrl({ category, query: activeQuery }, 'push')
    },
    [activeQuery, updateUrl]
  )

  const handleQueryChange = useCallback(
    (query: string) => {
      setQueryInput(query)
      setCurrentPage(1)
      updateUrl({ category: activeCategory, query }, 'replace')
    },
    [activeCategory, updateUrl]
  )

  const handleResetFilters = useCallback(() => {
    setQueryInput('')
    setActiveCategory(undefined)
    setCurrentPage(1)
    updateUrl({}, 'push')
  }, [updateUrl])

  return (
    <div className={styles.listPage}>
      <BlogHero compact={isFiltered} />

      {isFiltered || featuredPosts.length === 0 ? null : (
        <section
          aria-labelledby="featured-posts-title"
          className={styles.featuredSection}
        >
          <header className={styles.sectionHeader}>
            <h2 id="featured-posts-title">代表作</h2>
          </header>
          <div className={styles.featuredGrid}>
            {featuredPosts[0] ? (
              <PostCard eager post={featuredPosts[0]} variant="lead" />
            ) : null}
            <div className={styles.featuredSupportingGrid}>
              {featuredPosts.slice(1).map((post) => (
                <PostCard key={post.url} post={post} variant="supporting" />
              ))}
            </div>
          </div>
        </section>
      )}

      <section
        aria-labelledby="all-posts-title"
        className={styles.archiveSection}
      >
        <header className={styles.archiveHeader}>
          <h2 id="all-posts-title">全部文章</h2>
        </header>

        <CategoryFilter
          activeCategory={activeCategory}
          categories={categories}
          onCategoryChange={handleCategoryChange}
          onQueryChange={handleQueryChange}
          query={queryInput}
          resultCount={filteredPosts.length}
          totalPosts={posts.length}
        />

        <section aria-label="文章列表" className={styles.postList}>
          {visiblePosts.length > 0 ? (
            visiblePosts.map((post, index) => (
              <PostCard
                eager={isFiltered && index === 0}
                key={post.url}
                post={post}
              />
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
                <Button onClick={handleResetFilters} variant="outline">
                  查看全部文章
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </section>

        {totalPages > 1 ? (
          <BlogPagination
            activeCategory={activeCategory}
            currentPage={safePage}
            query={activeQuery || undefined}
            totalPages={totalPages}
          />
        ) : null}
      </section>

      <aside
        aria-labelledby="blog-contact-title"
        className={styles.blogContact}
      >
        <div>
          <h2 id="blog-contact-title">保持联系</h2>
          <p>想继续聊这些问题，欢迎来信，或在 GitHub 找我。</p>
        </div>
        <div className={styles.blogContactLinks}>
          <a href="mailto:tun.nozomi@gmail.com">
            <MailIcon aria-hidden="true" />
            邮箱联系
          </a>
          <a
            href="https://github.com/tuntun0609"
            rel="noopener"
            target="_blank"
          >
            GitHub
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        </div>
      </aside>
    </div>
  )
}
