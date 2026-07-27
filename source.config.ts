import { pageSchema } from 'fumadocs-core/source/schema'
import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { z } from 'zod'

export const posts = defineDocs({
  dir: 'content/blog',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema.extend({
      category: z.string().min(1),
      cover: z.string().startsWith('/'),
      date: z.string().date(),
      published: z.boolean().default(true),
      tags: z
        .array(z.string().trim().min(1))
        .min(1)
        .refine((tags) => new Set(tags).size === tags.length, {
          message: 'Tags must be unique',
        }),
    }),
  },
})

export default defineConfig()
