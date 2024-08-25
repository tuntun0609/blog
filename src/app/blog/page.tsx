import dayjs from 'dayjs'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { allBlogs, Blog } from 'contentlayer/generated'

function PostCard(post: Blog) {
  return (
    <div className="mb-8">
      <h2 className="mb-1 text-xl">
        <Link href={post.url} className="text-blue-700 hover:text-blue-900 dark:text-blue-400">
          {post.title}
        </Link>
      </h2>
      <time dateTime={post.lastmod} className="mb-2 block text-xs text-gray-600">
        {dayjs(post.lastmod).format('YYYY-MM-DD HH:mm')}
      </time>
      <div className="flex flex-row gap-1 overflow-x-auto">
        {post.tags?.map(tag => (
          <Link key={tag} href={`/tag/${tag}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
              {tag}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const posts = allBlogs
  return (
    <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
      <h1 className="mb-8 text-center text-2xl font-black">My Blogs</h1>
      {posts.map((post, idx) => (
        <PostCard key={idx} {...post} />
      ))}
    </div>
  )
}
