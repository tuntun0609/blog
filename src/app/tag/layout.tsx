import { ReactNode } from 'react'

export const metadata = {
  title: {
    template: 'Tag | %s',
    default: 'Tag List',
  },
}

const Layout = ({ children }: { children: ReactNode }) => <>{children}</>

export default Layout
