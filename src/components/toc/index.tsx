'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

const TOC = () => {
  const [headings, setHeadings] = useState<{ text: string; id: string; level: string }[]>([])

  useEffect(() => {
    const articleElement = document.getElementById('article')

    if (!articleElement) {
      return
    }

    const extractedHeadings = Array.from(articleElement.querySelectorAll('h1, h2, h3')).map(
      heading => ({
        text: heading.textContent || '',
        id: heading.id || '',
        level: heading.nodeName,
      })
    )

    setHeadings(extractedHeadings)
  }, [])

  return (
    <>
      <ul className="sticky right-0 top-16 mt-6">
        {headings.map(({ text, id, level }) => (
          <li key={id} className={cn('my-2', level === 'H2' && 'pl-4', level === 'H3' && 'pl-6')}>
            <Link href={`#${id}`} className="link-hover">
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export default TOC
