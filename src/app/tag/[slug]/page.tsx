'use client'

import { BlogCard } from '@/components/post-card'
import { capitalize } from '@/lib/utils'
import { allBlogs } from 'contentlayer/generated'

export default function TagHome({ params }: { params: { slug: string } }) {
  let posts = allBlogs
  const tag = params.slug

  if (tag) {
    posts = posts.filter(post => post.tags?.includes(tag))
  }

  return (
    <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
      <h1 className="mb-8 text-center text-2xl font-black">
        Tag {tag ? ` | ${capitalize(tag)}` : ''}
      </h1>
      {posts.map((post, idx) => (
        <BlogCard key={idx} {...post} />
      ))}
    </div>
  )
}
