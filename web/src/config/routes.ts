export const APP_ROUTES = {
  // Wiki app routes
  WIKI: {
    HOME: '/',
    SEARCH: '/search',
    NEW: '/new',
    TAGS: '/tags',
    SETTINGS: '/settings',
    REDIRECTS: '/redirects',
  },
  // User account routes
  SETTINGS: {
    USER: {
      ACCOUNT: '/user/account',
      SESSIONS: '/user/sessions',
      PREFERENCES: '/user/preferences',
    },
    SYSTEM: {
      SETTINGS: '/system/settings',
      USERS: '/system/users',
      STATUS: '/system/status',
    },
  },
} as const

export type AppRoutes = typeof APP_ROUTES
