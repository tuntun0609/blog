import { Menu } from 'lucide-react'
import Link from 'next/link'

import DocSearch from '../doc-search'
import { ThemeToggle } from '../theme'
import { Button } from '../ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'

const headerConfig = [
  {
    label: 'Blog',
    href: '/blog',
  },
  {
    label: 'Tags',
    href: '/tag',
  },
  {
    label: 'Projects',
    href: '/project-list',
  },
]

export const Header = () => (
  <header className="sticky inset-x-0 top-0 z-40 mx-auto flex min-h-16 w-full max-w-[1000px] flex-row items-center justify-between bg-background/70 px-4 backdrop-blur-md backdrop-saturate-150 dark:bg-inherit md:px-20">
    <Link href="/">
      <div className="cursor-pointer text-2xl">Tuntun Blog</div>
    </Link>
    <nav className="flex flex-row items-center gap-2 md:gap-4">
      <DocSearch />
      {headerConfig.map(({ label, href }) => (
        <Link className="hidden md:block" key={label} href={href}>
          <div className="transition-colors hover:text-gray-400">{label}</div>
        </Link>
      ))}
      <Sheet>
        <SheetTrigger asChild>
          <Button aria-label="menu" variant="ghost" className="p-0 px-2 md:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription />
          </SheetHeader>
          <div className="flex flex-col gap-2 pt-6">
            {headerConfig.map(({ label, href }) => (
              <Link key={label} href={href} aria-label={label}>
                <SheetClose>
                  <div className="transition-colors hover:text-gray-400">{label}</div>
                </SheetClose>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <ThemeToggle />
    </nav>
  </header>
)
