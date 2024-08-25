import dayjs from 'dayjs'
import { Link } from 'next-view-transitions'

import { Blog } from 'contentlayer/generated'

import { Badge } from '../ui/badge'

export const BlogCard = (post: Blog) => (
  <div className="mb-8">
    <h2 className="mb-1 text-xl">
      <Link href={post.url} className="text-blue-700 hover:text-blue-900 dark:text-blue-400">
        {post.title}
      </Link>
    </h2>
    <time dateTime={post.lastMod} className="mb-2 block text-xs text-gray-600">
      {dayjs(post.lastMod).format('YYYY-MM-DD HH:mm')}
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
