import { APP_ROUTES } from '@/config/routes'
import {
  Home,
  Search,
  FilePlus,
  Tags,
  Settings as SettingsIcon,
  Link2,
  User,
  Monitor,
  Palette,
  Settings,
  Users,
  Activity,
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
          title: 'New Page',
          url: APP_ROUTES.WIKI.NEW,
          icon: FilePlus,
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          title: 'Wiki Settings',
          url: APP_ROUTES.WIKI.SETTINGS,
          icon: SettingsIcon,
        },
        {
          title: 'Redirects',
          url: APP_ROUTES.WIKI.REDIRECTS,
          icon: Link2,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          title: 'Profile',
          url: APP_ROUTES.SETTINGS.USER.ACCOUNT,
          icon: User,
        },
        {
          title: 'Sessions',
          url: APP_ROUTES.SETTINGS.USER.SESSIONS,
          icon: Monitor,
        },
        {
          title: 'Preferences',
          url: APP_ROUTES.SETTINGS.USER.PREFERENCES,
          icon: Palette,
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          title: 'Settings',
          url: APP_ROUTES.SETTINGS.SYSTEM.SETTINGS,
          icon: Settings,
        },
        {
          title: 'Users',
          url: APP_ROUTES.SETTINGS.SYSTEM.USERS,
          icon: Users,
        },
        {
          title: 'Status',
          url: APP_ROUTES.SETTINGS.SYSTEM.STATUS,
          icon: Activity,
        },
      ],
    },
  ],
}
