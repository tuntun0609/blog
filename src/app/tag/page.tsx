import Link from 'next/link'

import tags from '@/tags.json'

// 按字母排序
tags.sort((a, b) => a.tag.localeCompare(b.tag))

const TagList = () => (
  <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
    <h1 className="mb-8 flex items-center justify-center gap-2 text-2xl font-black">Tags 🏷</h1>

    {/* 分三列 */}
    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
      {tags.map(tag => (
        <div key={tag.tag}>
          <Link
            className="text-blue-600 transition-colors duration-150 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-200"
            href={`/tag/${tag.tag}`}
          >
            {tag.tag} ({tag.count})
          </Link>
        </div>
      ))}
    </div>
  </div>
)

export default TagList
