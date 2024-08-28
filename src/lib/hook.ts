import { useSearchParams } from 'next/navigation'

import { config } from '@/config'

export const usePage = ({ total }: { total: number }) => {
  const searchParams = useSearchParams()
  let page = searchParams.get('page') ? parseInt(searchParams.get('page') as string) : 1
  const totalPage = Math.ceil(total / config.blogPageSize)

  if (page > totalPage) {
    page = totalPage
  }

  return { page, totalPage }
}
