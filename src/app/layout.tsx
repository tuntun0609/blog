// import { ViewTransitions } from 'next-view-transitions'

import { Analytics } from '@/components/clarity-analytics'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ThemeProvider } from '@/components/theme'
import { siteMetadata } from '@/config/siteMeta'

import type { Metadata } from 'next'

import '@/style/globals.css'
import '@/style/mdx.css'
import 'katex/dist/katex.css'
import 'remark-github-blockquote-alert/alert.css'
import 'react-photo-view/dist/react-photo-view.css'

export const metadata: Metadata = {
  ...siteMetadata,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // <ViewTransitions>
    <html lang="en" className="scroll-p-16 scroll-smooth" suppressHydrationWarning>
      <head>
        <meta
          name="google-site-verification"
          content="oB0kdf2_VvKkELCcNraxJAPze44Gs4DFafScoBjWGPI"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
      <Analytics />
    </html>
    // </ViewTransitions>
  )
}
