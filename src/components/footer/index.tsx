import { Mail } from 'lucide-react'

import BiliBili from '@public/bilibili.svg'
import Github from '@public/github.svg'
import X from '@public/x.svg'

const socialIconConfig = [
  {
    icon: <Mail className="h-6 w-6 transition-colors duration-150 hover:text-blue-400" />,
    href: 'mailto:tun.nozomi@gmail.com',
  },
  {
    icon: <Github className="h-6 w-6 transition-colors duration-150 hover:text-blue-400" />,
    href: 'https://github.com/tuntun0609',
  },
  {
    icon: (
      <X className="h-5 w-5 cursor-pointer transition-colors duration-150 hover:fill-blue-400" />
    ),
    href: 'https://x.com/TunTun669664',
  },
  {
    icon: (
      <BiliBili className="h-6 w-6 cursor-pointer fill-gray-700 transition-colors duration-150 hover:fill-blue-400" />
    ),
    href: 'https://space.bilibili.com/47706697',
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
    <div>Tuntun0609 • © {new Date().getFullYear()} • Blog Starter</div>
  </footer>
)
