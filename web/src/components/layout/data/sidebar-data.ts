import { APP_ROUTES } from '@/config/routes'
import {
  Home,
  Search,
  FilePlus,
  Tags,
  History,
  Settings as SettingsIcon,
} from 'lucide-react'
import { type SidebarData } from '@mochi/common'

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: 'Browse',
      items: [
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
