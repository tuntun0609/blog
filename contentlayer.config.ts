import path from 'path'

import { defineDocumentType, makeSource } from 'contentlayer2/source-files'
import fs from 'fs-extra'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { Blog } from 'contentlayer/generated'

const linkIcon = fromHtmlIsomorphic(
  '<span aria-hidden="true" class="content-header-link"><svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 linkIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>',
  {
    fragment: true,
  }
)

export const blogSource = defineDocumentType(() => ({
  name: 'Blog',
  filePathPattern: '**/*.(md|mdx)',
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'date' },
    tags: { type: 'list', of: { type: 'string' } },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: post => `/blog/${post._raw.flattenedPath}`,
    },
    lastmod: {
      type: 'date',
      resolve: post => {
        if (post.date) {
          return post.date
        }
        const filePath = path.join(process.cwd(), 'src/content', post._raw.sourceFilePath)
        // 读取文件的修改时间
        const stats = fs.statSync(filePath)
        return stats.mtime
      },
    },
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
  documentTypes: [blogSource],
  mdx: {
    cwd: process.cwd(),
    remarkPlugins: [remarkMath, remarkGfm],
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
    ],
  },
  onSuccess: async importData => {
    const { allBlogs } = await importData()
    await generateTags(allBlogs)
  },
})
