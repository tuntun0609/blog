'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const themeConfig = [
  {
    label: 'Light',
    icon: <Sun className="h-4 w-4" />,
    value: 'light',
  },
  {
    label: 'Dark',
    icon: <Moon className="h-4 w-4" />,
    value: 'dark',
  },
  {
    label: 'System',
    icon: <SunMoon className="h-4 w-4" />,
    value: 'system',
  },
]

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[150px] flex-col gap-1 p-2" align="end">
        {themeConfig.map(config => (
          <Button
            key={config.value}
            variant="ghost"
            className={cn(
              'w-full justify-start gap-2 p-2 pl-4',
              theme === config.value && 'bg-gray-100 dark:bg-gray-800'
            )}
            onClick={() => setTheme(config.value)}
          >
            {config.icon}
            {config.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
