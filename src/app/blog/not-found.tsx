import { MoveRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import NotFoundImage from '@public/image/not-found.svg'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
      <div className="mx-auto mb-8 h-auto w-[80%]">
        <NotFoundImage className="w-full" />
      </div>
      <div className="flex justify-center">
        <Link href="/">
          <Button variant="secondary" className="group transition duration-150 hover:bg-blue-100">
            <span className="mr-2">Home</span>
            <MoveRight size={14} className="transition-all duration-150 group-hover:ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
