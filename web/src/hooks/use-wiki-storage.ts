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
  } catch (e) {
    console.warn('[WikiStorage] Failed to cache wikis list:', e)
  }
}

// Get cached wikis list
export function getCachedWikisList(): WikisCache | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.WIKIS_LIST)
    if (!cached) return null
    return JSON.parse(cached) as WikisCache
  } catch (e) {
    console.warn('[WikiStorage] Failed to get cached wikis list:', e)
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
  } catch (e) {
    console.warn('[WikiStorage] Failed to store last location:', e)
  }
}

// Get last visited location
export function getLastLocation(): LastLocation | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION)
    if (!stored) return null
    return JSON.parse(stored) as LastLocation
  } catch (e) {
    console.warn('[WikiStorage] Failed to get last location:', e)
    return null
  }
}

// Clear last location (e.g., when wiki is deleted)
export function clearLastLocation(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_LOCATION)
  } catch (e) {
    console.warn('[WikiStorage] Failed to clear last location:', e)
  }
}
