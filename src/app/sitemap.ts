import type { MetadataRoute } from 'next'
import { getPublishedPosts } from '@/lib/blog'

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
)

const staticPages: MetadataRoute.Sitemap = [
  {
    changeFrequency: 'yearly',
    priority: 1,
    url: siteUrl.toString(),
  },
  {
    changeFrequency: 'weekly',
    priority: 0.8,
    url: new URL('/blog', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.7,
    url: new URL('/tools', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/video-convert', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/image-crop', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/document-calibration', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/background-removal', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/color-palette', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/json-viewer', siteUrl).toString(),
  },
  {
    changeFrequency: 'monthly',
    priority: 0.6,
    url: new URL('/tools/text-diff', siteUrl).toString(),
  },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const postPages = getPublishedPosts().map((post) => ({
    changeFrequency: 'monthly' as const,
    lastModified: post.data.date,
    priority: 0.6,
    url: new URL(post.url, siteUrl).toString(),
  }))

  return [...staticPages, ...postPages]
}
