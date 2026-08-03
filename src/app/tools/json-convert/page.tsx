import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { JsonConverter } from './json-converter'

export const metadata: Metadata = {
  description: '在 JSON 字符串和普通字符串之间进行双向转换。',
  title: 'JSON 字符串转换',
}

export default function JsonConvertPage() {
  return (
    <>
      <SiteHeader activeSection="tools" />
      <main>
        <JsonConverter />
      </main>
    </>
  )
}
