import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatPostDate } from '@/lib/blog'
import type { BlogCategory } from '@/lib/blog-taxonomy'
import styles from './blog.module.css'

interface PostCardProps {
  post: {
    url: string
    data: {
      title?: string
      description?: string
      date: string
      category: BlogCategory
      cover: string
      tags: string[]
    }
  }
  preload?: boolean
}

export function PostCard({ post, preload = false }: PostCardProps) {
  const title = post.data.title ?? '未命名文章'

  return (
    <Link className={styles.postLink} href={post.url}>
      <article className={styles.postRow}>
        <div className={styles.postImage}>
          <Image
            alt={title}
            fill
            preload={preload}
            sizes="(max-width: 680px) 1px, (max-width: 880px) 136px, 168px"
            src={post.data.cover}
          />
        </div>
        <div className={styles.postCopy}>
          <div className={styles.postMeta}>
            <span className={styles.postCategory}>{post.data.category}</span>
            <time className={styles.postDate} dateTime={post.data.date}>
              {formatPostDate(post.data.date)}
            </time>
          </div>
          <h2 className={styles.postTitle}>{title}</h2>
          <p className={styles.postDescription}>{post.data.description}</p>
          {post.data.tags.length > 0 ? (
            <ul aria-label="文章标签" className={styles.postTags}>
              {post.data.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary">{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </article>
    </Link>
  )
}
