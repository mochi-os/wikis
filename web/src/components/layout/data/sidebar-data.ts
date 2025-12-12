import { APP_ROUTES } from '@/config/routes'
import {
  Home,
  Search,
  FilePlus,
  Tags,
  Settings as SettingsIcon,
} from 'lucide-react'
import { type SidebarData } from '../types'

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
