import path from 'path'

import { defineDocumentType, makeSource } from 'contentlayer2/source-files'
import fs from 'fs-extra'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { remarkImgToJsx } from 'pliny/mdx-plugins/index.js'
import readingTime from 'reading-time'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypePresetMinify from 'rehype-preset-minify'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { remarkAlert } from 'remark-github-blockquote-alert'
import remarkMath from 'remark-math'

import { Blog } from 'contentlayer/generated'

import { formatDuration } from './src/lib/utils'

const linkIcon = fromHtmlIsomorphic(
  '<span aria-hidden="true" class="content-header-link"><svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 linkIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>',
  {
    fragment: true,
  }
)

export const blogSource = defineDocumentType(() => ({
  name: 'Blog',
  filePathPattern: 'blog/**/*.(md|mdx)',
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'date' },
    tags: { type: 'list', of: { type: 'string' } },
    summary: { type: 'string' },
    path: { type: 'string' },
  },
  computedFields: {
    slug: {
      type: 'string',
      resolve: doc => doc.path ?? doc._raw.flattenedPath.replace(/^.+?(\/)/, ''),
    },
    readingTime: { type: 'json', resolve: doc => formatDuration(readingTime(doc.body.raw).time) },
  },
}))

export const pageSource = defineDocumentType(() => ({
  name: 'Page',
  filePathPattern: 'page/**/*.(md|mdx)',
  contentType: 'mdx',
  fields: {
    key: { type: 'string', required: true },
  },
}))

const generateTags = async (allBlogs: Blog[]) => {
  const tags: Record<string, number> = {}
  allBlogs.forEach(blog => {
    if (blog.tags) {
      blog.tags.forEach(tag => {
        tags[tag] = (tags[tag] || 0) + 1
      })
    }
  })
  const tagsObj = Object.entries(tags).map(([tag, count]) => ({ tag, count }))
  // 保存到文件
  const tagsFilePath = path.join(process.cwd(), 'src/tags.json')
  await fs.writeJson(tagsFilePath, tagsObj, { spaces: 2 })
}

export default makeSource({
  contentDirPath: 'src/content',
  documentTypes: [blogSource, pageSource],
  mdx: {
    cwd: process.cwd(),
    remarkPlugins: [remarkMath, remarkGfm, remarkImgToJsx, remarkAlert],
    rehypePlugins: [
      rehypeKatex,
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'prepend',
          headingProperties: {
            className: ['content-header'],
          },
          properties: {
            ariaHidden: undefined,
          },
          content: linkIcon.children,
        },
      ],
      [
        rehypePrettyCode,
        {
          theme: 'one-dark-pro',
        },
      ],
      rehypePresetMinify,
    ],
  },
  onSuccess: async importData => {
    const { allBlogs } = await importData()
    await generateTags(allBlogs)
  },
})
