import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatPostDate } from '@/lib/blog'

type PostCardProps = {
  post: {
    url: string
    data: {
      title?: string
      description?: string
      date: string
      category: string
      cover: string
    }
  }
  preload?: boolean
}

export function PostCard({ post, preload = false }: PostCardProps) {
  const title = post.data.title ?? '未命名文章'

  return (
    <Link className="group block h-full" href={post.url}>
      <Card className="h-full gap-0 py-0">
        <div className="relative aspect-video overflow-hidden">
          <Image
            alt={title}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            fill
            preload={preload}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={post.data.cover}
          />
        </div>
        <CardHeader className="gap-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary">{post.data.category}</Badge>
            <time
              className="text-muted-foreground text-xs"
              dateTime={post.data.date}
            >
              {formatPostDate(post.data.date)}
            </time>
          </div>
          <CardTitle>
            <h2 className="line-clamp-2">{title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <CardDescription className="line-clamp-2">
            {post.data.description}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  )
}
