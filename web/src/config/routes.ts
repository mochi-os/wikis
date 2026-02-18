export const APP_ROUTES = {
  // Wiki app routes
  WIKI: {
    HOME: '/',
    SEARCH: '/search',
    NEW: '/new',
    JOIN: '/join',
    TAGS: '/tags',
    CHANGES: '/changes',
    SETTINGS: '/settings',
    REDIRECTS: '/redirects',
  },
} as const

export type AppRoutes = typeof APP_ROUTES
