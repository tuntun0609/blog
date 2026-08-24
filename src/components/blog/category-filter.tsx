'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { type ChangeEvent, type MouseEvent, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import type { BlogCategory } from '@/lib/blog-taxonomy'
import type { BlogCategoryFacet } from '@/lib/blog-types'
import { getBlogListHref } from '@/lib/blog-url'
import styles from './blog.module.css'

interface CategoryFilterProps {
  activeCategory?: BlogCategory
  categories: readonly BlogCategoryFacet[]
  onCategoryChange: (category?: BlogCategory) => void
  onQueryChange: (query: string) => void
  query?: string
  resultCount: number
  totalPosts: number
}

interface CategoryBadgeLinkProps {
  active: boolean
  category?: BlogCategory
  count: number
  label: string
  onCategoryChange: (category?: BlogCategory) => void
  query?: string
}

const hasModifiedClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.altKey || event.ctrlKey || event.metaKey || event.shiftKey

function CategoryBadgeLink({
  active,
  category,
  count,
  label,
  onCategoryChange,
  query,
}: CategoryBadgeLinkProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (hasModifiedClick(event)) {
        return
      }

      event.preventDefault()
      onCategoryChange(category)
    },
    [category, onCategoryChange]
  )

  return (
    <Badge
      render={
        <Link
          aria-current={active ? 'page' : undefined}
          aria-label={`显示${label}文章，共 ${count} 篇`}
          href={getBlogListHref({ category, query })}
          onClick={handleClick}
        />
      }
      variant={active ? 'default' : 'outline'}
    >
      {label} · {count}
    </Badge>
  )
}

const getResultDescription = ({
  activeCategory,
  query,
  resultCount,
  totalPosts,
}: Pick<
  CategoryFilterProps,
  'activeCategory' | 'query' | 'resultCount' | 'totalPosts'
>): string => {
  if (activeCategory && query) {
    return `在 ${activeCategory} 中找到 ${resultCount} 篇与“${query}”相关的文章`
  }

  if (query) {
    return `找到 ${resultCount} 篇与“${query}”相关的文章`
  }

  if (activeCategory) {
    return `${activeCategory} · ${resultCount} 篇文章`
  }

  return `浏览全部 ${totalPosts} 篇文章`
}

export function CategoryFilter({
  activeCategory,
  categories,
  onCategoryChange,
  onQueryChange,
  query,
  resultCount,
  totalPosts,
}: CategoryFilterProps) {
  const resultDescription = getResultDescription({
    activeCategory,
    query,
    resultCount,
    totalPosts,
  })
  const handleClearQuery = useCallback(() => onQueryChange(''), [onQueryChange])
  const handleQueryInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onQueryChange(event.currentTarget.value),
    [onQueryChange]
  )

  return (
    <section aria-labelledby="blog-filter-title" className={styles.blogFilter}>
      <h3 className="sr-only" id="blog-filter-title">
        查找文章
      </h3>
      <p aria-live="polite" className="sr-only">
        {resultDescription}
      </p>

      <search className={styles.articleSearch}>
        <InputGroup>
          <InputGroupInput
            aria-label="搜索文章"
            autoComplete="off"
            name="q"
            onChange={handleQueryInputChange}
            placeholder="搜索标题、主题或技术"
            type="search"
            value={query ?? ''}
          />
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="清除搜索"
                onClick={handleClearQuery}
                size="icon-xs"
              >
                <XIcon aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </search>

      <nav aria-label="文章分类" className={styles.categoryFilterOptions}>
        <CategoryBadgeLink
          active={activeCategory === undefined}
          count={totalPosts}
          label="全部"
          onCategoryChange={onCategoryChange}
          query={query}
        />
        {categories.map((category) => (
          <CategoryBadgeLink
            active={category.name === activeCategory}
            category={category.name}
            count={category.count}
            key={category.name}
            label={category.name}
            onCategoryChange={onCategoryChange}
            query={query}
          />
        ))}
      </nav>
    </section>
  )
}
