'use client'

import Giscus from '@giscus/react'
import { useTheme } from 'next-themes'

export const GiscusComment = () => {
  const { theme } = useTheme()
  return (
    <Giscus
      id="comments"
      repo="tuntun0609/comment"
      repoId="R_kgDOL5Jp-w"
      category="Announcements"
      categoryId="DIC_kwDOL5Jp-84Ch89Z"
      inputPosition="top"
      theme={theme === 'dark' ? 'dark_tritanopia' : 'preferred_color_scheme'}
      lang="zh-CN"
      loading="lazy"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="0"
      mapping="pathname"
    />
  )
}
