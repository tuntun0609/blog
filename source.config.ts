import { pageSchema } from 'fumadocs-core/source/schema'
import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { z } from 'zod'
import { BLOG_CATEGORIES } from './src/lib/blog-taxonomy'

export const posts = defineDocs({
  dir: 'content/blog',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema.extend({
      category: z.enum(BLOG_CATEGORIES),
      cover: z.string().startsWith('/'),
      date: z.iso.date(),
      path: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      published: z.boolean().default(true),
      tags: z
        .array(z.string().trim().min(1))
        .max(2)
        .default([])
        .refine((tags) => new Set(tags).size === tags.length, {
          message: 'Tags must be unique',
        }),
    }),
  },
})

export default defineConfig()
