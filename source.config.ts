import { pageSchema } from 'fumadocs-core/source/schema'
import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { z } from 'zod'

export const posts = defineDocs({
  dir: 'content/blog',
  docs: {
    schema: pageSchema.extend({
      category: z.string().min(1),
      cover: z.string().startsWith('/'),
      date: z.string().date(),
      published: z.boolean().default(true),
      readingTime: z.string().min(1),
    }),
  },
})

export default defineConfig()
