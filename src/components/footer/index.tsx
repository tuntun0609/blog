import { Mail } from 'lucide-react'

import { siteMetadata } from '@/config/siteMeta'
import BiliBili from '@public/image/bilibili.svg'
import Github from '@public/image/github.svg'
import X from '@public/image/x.svg'

const socialIconConfig = [
  {
    icon: <Mail className="h-6 w-6 transition-colors duration-150 hover:text-blue-400" />,
    href: `mailto:${siteMetadata.email}`,
  },
  {
    icon: <Github className="h-6 w-6 transition-colors duration-150 hover:text-blue-400" />,
    href: siteMetadata.github,
  },
  {
    icon: (
      <X className="h-5 w-5 cursor-pointer fill-gray-700 transition-colors duration-150 hover:fill-blue-400" />
    ),
    href: siteMetadata.x,
  },
  {
    icon: (
      <BiliBili className="h-6 w-6 cursor-pointer fill-gray-700 transition-colors duration-150 hover:fill-blue-400" />
    ),
    href: siteMetadata.bilibili,
  },
]

export const Footer = () => (
  <footer className="flex flex-col items-center justify-center py-8 text-sm text-gray-600">
    <div className="mb-2 flex items-center justify-center text-gray-700">
      {socialIconConfig.map(({ icon: Icon, href }) => (
        <a key={href} href={href} className="mx-2" target="_blank" referrerPolicy="no-referrer">
          {Icon}
        </a>
      ))}
    </div>
    <div>Tuntun0609 • © {new Date().getFullYear()} • Tuntun Blog</div>
  </footer>
)
