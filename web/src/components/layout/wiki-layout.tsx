import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  AuthenticatedLayout,
  getErrorMessage,
  type SidebarData,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
  toast,
  SearchEntityDialog,
} from '@mochi/common'
import {
  BookOpen,
  Bookmark,
  Library,
  Plus,
} from 'lucide-react'
import { APP_ROUTES } from '@/config/routes'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { useAddBookmark, useJoinWiki } from '@/hooks/use-wiki'

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
  const {
    bookmarkDialogOpen,
    closeBookmarkDialog,
    searchDialogOpen,
    closeSearchDialog,
  } = useSidebarContext()
  const { info } = useWikiContext()
  const navigate = useNavigate()
  const [bookmarkTarget, setBookmarkTarget] = useState('')
  const addBookmark = useAddBookmark()
  const joinWiki = useJoinWiki()

  const handleSearchSubscribe = async (wikiId: string) => {
    return new Promise<void>((resolve, reject) => {
      joinWiki.mutate(wikiId, {
        onSuccess: () => {
          closeSearchDialog()
          navigate({ to: '/' })
          resolve()
        },
        onError: (error) => {
          reject(error)
        },
      })
    })
  }

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

    // Merge owned wikis and bookmarks into a single flat list
    // All wikis use the same icon (BookOpen), sorted alphabetically
    const allWikiItems = [
      ...(info?.wikis || []).map((wiki) => ({
        title: wiki.name,
        url: `/${wiki.fingerprint ?? wiki.id}/${wiki.home}` as const,
        icon: BookOpen,
        isActive: wiki.id === currentWikiId || wiki.fingerprint === currentWikiId,
      })),
      ...(info?.bookmarks || []).map((bookmark) => ({
        title: bookmark.name,
        url: `/${bookmark.fingerprint ?? bookmark.id}/home` as const,
        icon: BookOpen,
        isActive: bookmark.id === currentWikiId || bookmark.fingerprint === currentWikiId,
      })),
    ].sort((a, b) => a.title.localeCompare(b.title))

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

    // "All wikis" is now a simple link without submenu
    const allWikisItem = {
      title: 'All wikis',
      url: '/',
      icon: Library,
    }

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [
          allWikisItem,
          ...allWikiItems,
          ...(standaloneWikiItem ? [standaloneWikiItem] : []),
        ],
      },
      {
        title: '',
        separator: true,
        items: [
          { title: 'New wiki', url: APP_ROUTES.WIKI.NEW, icon: Plus },
        ],
      },
    ]

    return { navGroups: groups }
  }, [isInWiki, wikiName, info, urlEntityId])

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

      {/* Search wiki dialog */}
      <SearchEntityDialog
        open={searchDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSearchDialog()
        }}
        onSubscribe={handleSearchSubscribe}
        entityClass="wiki"
        searchEndpoint="/wikis/directory/search"
        icon={BookOpen}
        iconClassName="bg-emerald-500/10 text-emerald-600"
        title="Search wikis"
        description="Search for public wikis to subscribe to"
        placeholder="Search by name, ID, fingerprint, or URL..."
        emptyMessage="No wikis found"
      />
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
