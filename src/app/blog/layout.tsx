import { ReactNode } from 'react'

export const metadata = {
  title: {
    template: 'Blog | %s',
    default: 'Blog List',
  },
}

const Layout = ({ children }: { children: ReactNode }) => <>{children}</>

export default Layout
