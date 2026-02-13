import { Outlet } from '@tanstack/react-router'
import {
  cn,
  getCookie,
  LayoutProvider,
  SidebarInset,
  SidebarProvider,
  TopBar,
  AppSidebar,
} from '@mochi/common'
import { SearchProvider } from '@/context/search-provider'
import { sidebarData } from './data/sidebar-data'

type PublicLayoutProps = {
  children?: React.ReactNode
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <div className="flex h-svh w-full">
            {/* Left column: TopBar + Sidebar */}
            <div
              className={cn(
                'flex flex-col flex-shrink-0 overflow-visible',
                'w-(--sidebar-width) has-data-[state=collapsed]:w-(--sidebar-width-icon)',
                'transition-[width] duration-200 ease-linear'
              )}
            >
              <TopBar showNotifications={false} />
              <AppSidebar data={sidebarData} />
            </div>

            {/* Content area */}
            <SidebarInset className={cn('@container/content', 'overflow-auto')}>
              {children ?? <Outlet />}
            </SidebarInset>
          </div>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
