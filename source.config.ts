import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

export const posts = defineDocs({
  dir: "content/blog",
  docs: {
    schema: pageSchema.extend({
      date: z.string().date(),
      category: z.string().min(1),
      cover: z.string().startsWith("/"),
      readingTime: z.string().min(1),
      published: z.boolean().default(true),
    }),
  },
});

export default defineConfig();
