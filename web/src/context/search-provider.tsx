import { SearchProvider as BaseSearchProvider, CommandMenu } from '@mochi/common'
import { sidebarData } from '@/components/layout/data/sidebar-data'

type SearchProviderProps = {
  children: React.ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  return (
    <BaseSearchProvider>
      {children}
      <CommandMenu sidebarData={sidebarData} />
    </BaseSearchProvider>
  )
}

export { useSearch } from '@mochi/common'
