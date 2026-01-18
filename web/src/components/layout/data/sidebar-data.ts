import {
  History,
  Home,
  Library,
  Search,
  Tags,
} from 'lucide-react'
import type { SidebarData } from '@mochi/common'
import { APP_ROUTES } from '@/config/routes'

// Static sidebar data for CommandMenu (Cmd+K)
// The full dynamic sidebar is built in WikiLayout
export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: 'All wikis',
      items: [
        {
          title: 'All wikis',
          url: '/',
          icon: Library,
        },
      ],
    },
    {
      title: 'This wiki',
      items: [
        { title: 'Home', url: APP_ROUTES.WIKI.HOME, icon: Home },
        { title: 'Search', url: APP_ROUTES.WIKI.SEARCH, icon: Search },
        { title: 'Tags', url: APP_ROUTES.WIKI.TAGS, icon: Tags },
        { title: 'Recent changes', url: APP_ROUTES.WIKI.CHANGES, icon: History },
      ],
    },
  ],
}
