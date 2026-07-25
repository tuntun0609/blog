import { BookOpenTextIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            aria-label="开发札记首页"
            className="flex items-center gap-2 font-semibold"
            href="/blog"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpenTextIcon aria-hidden="true" className="size-4" />
            </span>
            <span>开发札记</span>
          </Link>
          <nav aria-label="主导航" className="flex items-center gap-1">
            <Button
              nativeButton={false}
              render={<Link href="/blog" />}
              variant="ghost"
            >
              博客
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16">
        <Separator />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>持续记录，认真构建。</p>
          <p>© 2026 开发札记</p>
        </div>
      </footer>
    </div>
  )
}
