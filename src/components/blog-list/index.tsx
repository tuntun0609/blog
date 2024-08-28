'use client'

import { config } from '@/config'
import { usePage } from '@/lib/hook'
import { Blog } from 'contentlayer/generated'

import { BlogCard } from '../post-card'

export const BlogList = ({ blogs }: { blogs: Blog[] }) => {
  const { page } = usePage({ total: blogs.length })
  const showBlogs = blogs.slice((page - 1) * config.blogPageSize, page * config.blogPageSize)

  return (
    <>
      {showBlogs.map(blog => (
        <BlogCard key={blog.slug} {...blog} />
      ))}
    </>
  )
}
