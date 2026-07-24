import type { Metadata } from 'next'
import { Geist_Mono, Noto_Sans } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: {
    default: '开发札记',
    template: '%s | 开发札记',
  },
  description: '关于现代 Web 开发、产品工程与实践的思考。',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn(
        'h-full antialiased',
        geistMono.variable,
        notoSans.variable,
      )}>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  )
}
