'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { type ChangeEvent, useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import type { BlogTagFacet } from '@/lib/blog-types'
import { getBlogListHref } from '@/lib/blog-url'
import styles from './blog.module.css'

interface TagFilterControlsProps {
  activeTag?: string
  resultDescription: string
  tags: readonly BlogTagFacet[]
  totalPosts: number
}

const normalizeSearchText = (value: string): string =>
  value.trim().toLocaleLowerCase('zh-CN')

export function TagFilterControls({
  activeTag,
  resultDescription,
  tags,
  totalPosts,
}: TagFilterControlsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const clearSearch = useCallback(() => setSearchQuery(''), [])
  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setSearchQuery(event.currentTarget.value),
    []
  )
  const normalizedQuery = normalizeSearchText(searchQuery)
  const filteredTags = normalizedQuery
    ? tags.filter((tag) =>
        normalizeSearchText(tag.name).includes(normalizedQuery)
      )
    : tags
  const searchSummary = normalizedQuery
    ? `找到 ${filteredTags.length} 个标签`
    : `共 ${tags.length} 个标签`

  return (
    <>
      <div className={styles.tagFilterHeader}>
        <div>
          <h2 id="tag-filter-title">按标签筛选</h2>
          <p>{resultDescription}</p>
        </div>
        <div className={styles.tagSearch}>
          <InputGroup>
            <InputGroupInput
              aria-controls="tag-filter-options"
              aria-label="搜索标签"
              autoComplete="off"
              onChange={handleSearchChange}
              placeholder={`搜索 ${tags.length} 个标签`}
              type="search"
              value={searchQuery}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            {searchQuery ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="清除标签搜索"
                  onClick={clearSearch}
                  size="icon-xs"
                >
                  <XIcon aria-hidden="true" data-icon="inline-start" />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <p aria-live="polite" className={styles.tagSearchSummary}>
            {searchSummary}
          </p>
        </div>
      </div>

      <nav
        aria-label="文章标签"
        className={styles.tagFilterOptions}
        id="tag-filter-options"
      >
        <Badge
          render={
            <Link
              aria-current={activeTag ? undefined : 'true'}
              aria-label={`显示全部文章，共 ${totalPosts} 篇`}
              href={getBlogListHref()}
              onClick={clearSearch}
            />
          }
          variant={activeTag ? 'outline' : 'default'}
        >
          全部 · {totalPosts}
        </Badge>
        {filteredTags.map((tag) => {
          const isActive = tag.name === activeTag

          return (
            <Badge
              key={tag.name}
              render={
                <Link
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={
                    isActive
                      ? `清除标签“${tag.name}”`
                      : `筛选标签“${tag.name}”，${tag.count} 篇文章`
                  }
                  href={
                    isActive ? getBlogListHref() : getBlogListHref(1, tag.name)
                  }
                  onClick={clearSearch}
                />
              }
              variant={isActive ? 'default' : 'outline'}
            >
              {tag.name} · {tag.count}
            </Badge>
          )
        })}
      </nav>

      {filteredTags.length === 0 ? (
        <Empty className={styles.tagSearchEmpty}>
          <EmptyHeader>
            <EmptyTitle>没有匹配的标签</EmptyTitle>
            <EmptyDescription>
              请尝试更短的关键词，或清除搜索查看全部标签。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={clearSearch} variant="outline">
              <XIcon aria-hidden="true" data-icon="inline-start" />
              清除搜索
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}
    </>
  )
}
