// Get the app's base path from the current URL
// The app path is the first segment of the pathname (e.g., /wiki, /docs, /notes)
// This allows the app to be mounted at any URL path

// Routes that are class-level (not entity-specific)
const CLASS_ROUTES = ['new', 'create', 'info', 'assets', 'images']

// Cached values (computed once at startup)
let cachedAppPath: string | null = null
let cachedRouterBasepath: string | null = null
let cachedApiBasepath: string | null = null

// Get the app path (first URL segment, e.g., /wiki)
export function getAppPath(): string {
  if (cachedAppPath === null) {
    const pathname = window.location.pathname
    const match = pathname.match(/^(\/[^/]+)/)
    cachedAppPath = match ? match[1] : ''
  }
  return cachedAppPath
}

// Get the router basepath
// Class context: /<app>/ (e.g., /wiki/)
// Entity context: /<app>/<entity-id>/ (e.g., /wiki/abc123/)
export function getRouterBasepath(): string {
  if (cachedRouterBasepath === null) {
    const pathname = window.location.pathname
    const match = pathname.match(/^(\/[^/]+)\/([^/]+)/)
    if (match && !CLASS_ROUTES.includes(match[2])) {
      // Entity context: /<app>/<entity-id>/
      cachedRouterBasepath = `${match[1]}/${match[2]}/`
    } else {
      // Class context: /<app>/
      cachedRouterBasepath = getAppPath() + '/'
    }
  }
  return cachedRouterBasepath
}

// Get the API basepath
// Class context: /<app>/ (e.g., /wiki/)
// Entity context: /<app>/<entity-id>/-/ (e.g., /wiki/abc123/-/)
export function getApiBasepath(): string {
  if (cachedApiBasepath === null) {
    const pathname = window.location.pathname
    const match = pathname.match(/^(\/[^/]+)\/([^/]+)/)
    if (match && !CLASS_ROUTES.includes(match[2])) {
      // Entity context: /<app>/<entity-id>/-/
      cachedApiBasepath = `${match[1]}/${match[2]}/-/`
    } else {
      // Class context: /<app>/
      cachedApiBasepath = getAppPath() + '/'
    }
  }
  return cachedApiBasepath
}
