import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata } from 'next'
import { Geist_Mono, Noto_Sans, Shantell_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

import './globals.css'
import '@/styles/vendor/neat-annotations.css'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

const shantellSans = Shantell_Sans({
  subsets: ['latin'],
  variable: '--font-shantell-sans',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  description: '关于现代 Web 开发、产品工程与实践的思考。',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ),
  title: {
    default: '开发札记',
    template: '%s | 开发札记',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      className={cn(
        'h-full antialiased',
        geistMono.variable,
        notoSans.variable,
        shantellSans.variable
      )}
      lang="zh-CN"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <RootProvider>
          {children}
          <Toaster richColors />
        </RootProvider>
      </body>
    </html>
  )
}
