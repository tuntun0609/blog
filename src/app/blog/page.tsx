import { BlogList } from '@/components/blog-list'
import { BlogPagination } from '@/components/blog-pagination'
import { sortBlogs } from '@/lib/utils'
import { allBlogs } from 'contentlayer/generated'

export default function Blog() {
  let blogs = sortBlogs(allBlogs)

  return (
    <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
      <h1 className="mb-8 text-center text-2xl font-black">My Blogs 🗒</h1>
      <BlogList blogs={blogs} />
      <BlogPagination blogs={blogs} />
    </div>
  )
}
