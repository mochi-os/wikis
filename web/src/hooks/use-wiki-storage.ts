// localStorage utilities for wiki app

const STORAGE_KEYS = {
  WIKIS_LIST: 'mochi-wikis-list',
  LAST_LOCATION: 'mochi-wikis-last-location',
} as const

interface StoredWiki {
  id: string
  name: string
  source?: string
}

interface StoredBookmark {
  id: string
  name: string
}

interface WikisCache {
  wikis: StoredWiki[]
  bookmarks: StoredBookmark[]
  timestamp: number
}

interface LastLocation {
  wikiId: string
  pageSlug?: string
  timestamp: number
}

// Cache wikis list
export function cacheWikisList(wikis: StoredWiki[], bookmarks: StoredBookmark[]): void {
  try {
    const cache: WikisCache = {
      wikis,
      bookmarks,
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEYS.WIKIS_LIST, JSON.stringify(cache))
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

// Get cached wikis list
export function getCachedWikisList(): WikisCache | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.WIKIS_LIST)
    if (!cached) return null
    return JSON.parse(cached) as WikisCache
  } catch {
    return null
  }
}

// Store last visited location
export function setLastLocation(wikiId: string, pageSlug?: string): void {
  try {
    const location: LastLocation = {
      wikiId,
      pageSlug,
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify(location))
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

// Get last visited location
export function getLastLocation(): LastLocation | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION)
    if (!stored) return null
    return JSON.parse(stored) as LastLocation
  } catch {
    return null
  }
}

// Clear last location (e.g., when wiki is deleted)
export function clearLastLocation(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_LOCATION)
  } catch {
    // Silently fail
  }
}
