import { useMemo, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { AuthenticatedLayout, getErrorMessage } from '@mochi/common'
import type { SidebarData } from '@mochi/common'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
} from '@mochi/common'
import {
  BookOpen,
  Bookmark,
  Copy,
  History,
  Library,
  Plus,
  Search,
  Tags,
} from 'lucide-react'
import { toast } from '@mochi/common'
import { APP_ROUTES } from '@/config/routes'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { useAddBookmark } from '@/hooks/use-wiki'

// Check if a string looks like an entity ID (9-char fingerprint or 50-51 char full ID)
const ENTITY_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

// Extract entity ID from pathname
// URL pattern: /<app>/<entity>/<page> or /<entity>/<page> in entity context
function getEntityIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  for (const segment of segments.slice(0, 2)) {
    if (ENTITY_ID_PATTERN.test(segment)) {
      return segment
    }
  }
  return null
}

function WikiLayoutInner() {
  const { bookmarkDialogOpen, openBookmarkDialog, closeBookmarkDialog } = useSidebarContext()
  const { info } = useWikiContext()
  const [bookmarkTarget, setBookmarkTarget] = useState('')
  const addBookmark = useAddBookmark()

  // Use router location for reactive URL changes
  const location = useLocation()
  const urlEntityId = getEntityIdFromPath(location.pathname)

  // Whether we're inside a specific wiki - use URL as source of truth
  const isInWiki = urlEntityId !== null
  const wikiName = info?.wiki?.name

  const handleAddBookmark = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookmarkTarget.trim()) {
      toast.error('Wiki ID is required')
      return
    }
    addBookmark.mutate(bookmarkTarget.trim(), {
      onSuccess: () => {
        toast.success('Wiki bookmarked')
        setBookmarkTarget('')
        closeBookmarkDialog()
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to bookmark wiki'))
      },
    })
  }

  const sidebarData: SidebarData = useMemo(() => {
    // Get current wiki ID for highlighting - use URL as source of truth
    // If urlEntityId is null, we're not in a wiki (e.g., at "All wikis")
    const currentWikiId = urlEntityId

    // Build wiki items from the list (when in class context)
    // Use fingerprint for shorter URLs when available
    // Include home page in URL to avoid route ambiguity with $page vs $wikiId
    const wikiItems = (info?.wikis || []).map((wiki) => {
      const wikiUrl = wiki.fingerprint ?? wiki.id
      const isCurrentWiki = wiki.id === currentWikiId || wiki.fingerprint === currentWikiId
      return {
        title: wiki.name,
        url: `/${wikiUrl}/${wiki.home}` as const,
        icon: BookOpen,
        isActive: isCurrentWiki,
      }
    }).sort((a, b) => a.title.localeCompare(b.title))

    // Build bookmarked wiki items - use fingerprint for shorter URLs
    // Include home page in URL to avoid route ambiguity
    const bookmarkItems = (info?.bookmarks || []).map((bookmark) => {
      const isCurrentWiki = bookmark.id === currentWikiId || bookmark.fingerprint === currentWikiId
      return {
        title: bookmark.name,
        url: `/${bookmark.fingerprint ?? bookmark.id}/home` as const,
        icon: Bookmark,
        isActive: isCurrentWiki,
      }
    }).sort((a, b) => a.title.localeCompare(b.title))

    // Build current wiki item when in entity context but not in the wikis list
    // (This handles when we're viewing a wiki that might not be in our class list)
    const currentWikiInList = info?.wikis?.some(w => w.id === currentWikiId || w.fingerprint === currentWikiId)
    const currentWikiInBookmarks = info?.bookmarks?.some(b => b.id === currentWikiId || b.fingerprint === currentWikiId)
    const standaloneWikiUrl = info?.wiki?.fingerprint ?? info?.wiki?.id ?? urlEntityId
    const standaloneWikiHome = info?.wiki?.home || 'home'
    const standaloneWikiItem = isInWiki && !currentWikiInList && !currentWikiInBookmarks && standaloneWikiUrl ? {
      title: wikiName || 'Wiki',
      url: `/${standaloneWikiUrl}/${standaloneWikiHome}` as const,
      icon: BookOpen,
      isActive: true,
    } : null

    // Build "All wikis" item with submenu for wiki management actions
    // Collapse when inside a specific wiki
    const allWikisItem = {
      title: 'All wikis',
      url: '/',
      icon: Library,
      items: [
        { title: 'Bookmark wiki', icon: Bookmark, onClick: openBookmarkDialog },
        { title: 'Replicate wiki', url: APP_ROUTES.WIKI.JOIN, icon: Copy },
        { title: 'New wiki', url: APP_ROUTES.WIKI.NEW, icon: Plus },
      ],
      open: !isInWiki,
    }

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [
          allWikisItem,
          ...wikiItems,
          ...bookmarkItems,
          ...(standaloneWikiItem ? [standaloneWikiItem] : []),
        ],
      },
      {
        title: '',
        separator: true,
        items: [
          { title: 'Search', url: APP_ROUTES.WIKI.SEARCH, icon: Search },
          { title: 'Tags', url: APP_ROUTES.WIKI.TAGS, icon: Tags },
          { title: 'Recent changes', url: APP_ROUTES.WIKI.CHANGES, icon: History },
        ],
      },
    ]

    return { navGroups: groups }
  }, [openBookmarkDialog, isInWiki, wikiName, info, urlEntityId])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />
      {/* Bookmark wiki dialog */}
      <Dialog open={bookmarkDialogOpen} onOpenChange={(open) => { if (!open) closeBookmarkDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bookmark wiki</DialogTitle>
            <DialogDescription>
              Follow a wiki without making a local copy. You'll be able to view it directly from the source.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBookmark} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bookmark-target">Wiki entity ID</Label>
              <Input
                id="bookmark-target"
                placeholder="abc123..."
                value={bookmarkTarget}
                onChange={(e) => setBookmarkTarget(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeBookmarkDialog}
                disabled={addBookmark.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addBookmark.isPending}>
                <Bookmark className="mr-2 h-4 w-4" />
                {addBookmark.isPending ? 'Bookmarking...' : 'Bookmark'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function WikiLayout() {
  return (
    <WikiProvider>
      <SidebarProvider>
        <WikiLayoutInner />
      </SidebarProvider>
    </WikiProvider>
  )
}
