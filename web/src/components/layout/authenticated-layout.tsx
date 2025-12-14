import { Outlet } from '@tanstack/react-router'
import {
  cn,
  getCookie,
  LayoutProvider,
  SidebarInset,
  SidebarProvider,
  TopBar,
} from '@mochi/common'
import { SearchProvider } from '@/context/search-provider'
import { WikiProvider } from '@/context/wiki-context'
import { AppSidebar } from '@/components/layout/app-sidebar'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  return (
    <SearchProvider>
      <WikiProvider>
        <LayoutProvider>
          <div className="flex h-svh flex-col">
            <TopBar title="Wiki" />
            <SidebarProvider defaultOpen={defaultOpen} className="flex-1 overflow-hidden">
              <AppSidebar />
              <SidebarInset
                className={cn(
                  // Set content container, so we can use container queries
                  '@container/content',
                  // Allow scrolling in content area
                  'overflow-auto'
                )}
              >
                {children ?? <Outlet />}
              </SidebarInset>
            </SidebarProvider>
          </div>
        </LayoutProvider>
      </WikiProvider>
    </SearchProvider>
  )
}
