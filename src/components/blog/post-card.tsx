import Image from 'next/image'
import Link from 'next/link'
import { formatPostDate } from '@/lib/blog-date'
import type { BlogPostSummary } from '@/lib/blog-types'
import { cn } from '@/lib/utils'
import styles from './blog.module.css'

interface PostCardProps {
  eager?: boolean
  headingLevel?: 2 | 3
  post: BlogPostSummary
  variant?: 'archive' | 'lead' | 'supporting'
}

const IMAGE_SIZES = {
  archive:
    '(max-width: 680px) calc(100vw - 2rem), (max-width: 1200px) calc(50vw - 2rem), 33rem',
  lead: '(max-width: 680px) calc(100vw - 2rem), (max-width: 880px) calc(100vw - 2.5rem), 36rem',
  supporting:
    '(max-width: 680px) calc(100vw - 2rem), (max-width: 1200px) calc(25vw - 1.5rem), 16rem',
} as const

export function PostCard({
  eager = false,
  headingLevel = 3,
  post,
  variant = 'archive',
}: PostCardProps) {
  const title = post.data.title ?? '未命名文章'
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <Link
      className={cn(styles.postLink, styles[`postLink_${variant}`])}
      href={post.url}
    >
      <article className={cn(styles.postRow, styles[`postRow_${variant}`])}>
        <div className={cn(styles.postImage, styles[`postImage_${variant}`])}>
          <Image
            alt=""
            fill
            loading={eager ? 'eager' : 'lazy'}
            sizes={IMAGE_SIZES[variant]}
            src={post.data.cover}
          />
        </div>
        <div className={cn(styles.postCopy, styles[`postCopy_${variant}`])}>
          <div className={styles.postMeta}>
            <span className={styles.postCategory}>{post.data.category}</span>
            <time className={styles.postDate} dateTime={post.data.date}>
              {formatPostDate(post.data.date)}
            </time>
          </div>
          <Heading
            className={cn(styles.postTitle, styles[`postTitle_${variant}`])}
          >
            {title}
          </Heading>
          <p className={styles.postDescription}>{post.data.description}</p>
        </div>
      </article>
    </Link>
  )
}
