// Shell storage utilities for wiki app

import { shellStorage } from '@mochi/web'

const STORAGE_KEYS = {
  WIKIS_LIST: 'mochi-wikis-list',
  LAST_LOCATION: 'mochi-wikis-last-location',
} as const

interface StoredWiki {
  id: string
  name: string
  source?: string
}

interface WikisCache {
  wikis: StoredWiki[]
  timestamp: number
}

interface LastLocation {
  wikiId: string
  pageSlug?: string
  timestamp: number
}

// Cache wikis list
export function cacheWikisList(wikis: StoredWiki[]): void {
  const cache: WikisCache = {
    wikis,
    timestamp: Date.now(),
  }
  shellStorage.setItem(STORAGE_KEYS.WIKIS_LIST, JSON.stringify(cache))
}

// Store last visited location
export function setLastLocation(wikiId: string, pageSlug?: string): void {
  const location: LastLocation = {
    wikiId,
    pageSlug,
    timestamp: Date.now(),
  }
  shellStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify(location))
}

// Get last visited location
export async function getLastLocation(): Promise<LastLocation | null> {
  const stored = await shellStorage.getItem(STORAGE_KEYS.LAST_LOCATION)
  if (!stored) return null
  try {
    return JSON.parse(stored) as LastLocation
  } catch {
    return null
  }
}

// Clear last location (e.g., when wiki is deleted)
export function clearLastLocation(): void {
  shellStorage.removeItem(STORAGE_KEYS.LAST_LOCATION)
}
