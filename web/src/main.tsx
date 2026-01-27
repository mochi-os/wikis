import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { useAuthStore, ThemeProvider, createQueryClient } from '@mochi/common'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = createQueryClient({
  onServerError: () => router.navigate({ to: '/500' }),
})

// Check if a string looks like an entity ID (9-char fingerprint or 50-51 char full ID)
const isEntityId = (s: string): boolean =>
  /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s)

// Get basepath based on URL context:
// - Entity context (/<entity>/...): basepath is /<entity> for page routes
// - Class context (/wikis/...): basepath is /wikis so routes like $wikiId/$page work
// Note: /-/ prefix is only for API endpoints, not page routes
const getBasepath = () => {
  const pathname = window.location.pathname
  const match = pathname.match(/^\/([^/]+)/)
  if (!match) return '/'

  const firstSegment = match[1]

  // Entity context: first segment is an entity ID
  if (isEntityId(firstSegment)) {
    return `/${firstSegment}`
  }

  // Class context: just use the app name
  return `/${firstSegment}`
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  basepath: getBasepath(),
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Initialize auth state from cookie on app start
useAuthStore.getState().initialize()

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {/* <FontProvider> */}
          {/* <DirectionProvider> */}
          <RouterProvider router={router} />
          {/* </DirectionProvider> */}
          {/* </FontProvider> */}
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
