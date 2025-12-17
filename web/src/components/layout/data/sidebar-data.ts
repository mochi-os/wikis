import { APP_ROUTES } from '@/config/routes'
import { getAppPath } from '@mochi/common'
import {
  Home,
  Search,
  FilePlus,
  Tags,
  History,
  Library,
  Settings as SettingsIcon,
} from 'lucide-react'
import { type SidebarData } from '@mochi/common'

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: 'Browse',
      items: [
        {
          title: 'All wikis',
          url: getAppPath() + '/',
          icon: Library,
          external: true,
        },
        {
          title: 'Home',
          url: APP_ROUTES.WIKI.HOME,
          icon: Home,
        },
        {
          title: 'Search',
          url: APP_ROUTES.WIKI.SEARCH,
          icon: Search,
        },
        {
          title: 'Tags',
          url: APP_ROUTES.WIKI.TAGS,
          icon: Tags,
        },
        {
          title: 'Recent changes',
          url: APP_ROUTES.WIKI.CHANGES,
          icon: History,
        },
      ],
    },
    {
      title: 'Create',
      items: [
        {
          title: 'New page',
          url: APP_ROUTES.WIKI.NEW,
          icon: FilePlus,
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          title: 'Settings',
          url: APP_ROUTES.WIKI.SETTINGS,
          icon: SettingsIcon,
        },
      ],
    },
  ],
}
