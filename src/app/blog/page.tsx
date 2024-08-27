import { BlogCard } from '@/components/post-card'
import { allBlogs } from 'contentlayer/generated'

export default function Blog() {
  let posts = allBlogs

  return (
    <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
      <h1 className="mb-8 text-center text-2xl font-black">My Blogs 🗒</h1>
      {posts.map((post, idx) => (
        <BlogCard key={idx} {...post} />
      ))}
    </div>
  )
}
