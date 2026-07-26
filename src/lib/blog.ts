import { posts } from 'collections/server'
import { loader } from 'fumadocs-core/source'

export const blogSource = loader({
  baseUrl: '/blog',
  source: posts.toFumadocsSource(),
})

export const POSTS_PER_PAGE = 6

const HAN_CHARACTERS_PER_MINUTE = 400
const WORDS_PER_MINUTE = 200
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/gu
const WORD_PATTERN = /[\p{Alphabetic}\p{Number}]+/gu

export function getPublishedPosts() {
  return blogSource
    .getPages()
    .filter((post) => post.data.published)
    .sort((a, b) => Date.parse(b.data.date) - Date.parse(a.data.date))
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function estimateReadingTime(markdown: string) {
  const hanCharacterCount = markdown.match(HAN_CHARACTER_PATTERN)?.length ?? 0
  const nonHanText = markdown.replace(HAN_CHARACTER_PATTERN, ' ')
  const wordCount = nonHanText.match(WORD_PATTERN)?.length ?? 0
  const minutes = Math.max(
    1,
    Math.ceil(
      hanCharacterCount / HAN_CHARACTERS_PER_MINUTE +
        wordCount / WORDS_PER_MINUTE
    )
  )

  return `${minutes} 分钟阅读`
}
