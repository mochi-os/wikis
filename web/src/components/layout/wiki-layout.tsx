import { useMemo, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { AuthenticatedLayout, getAppPath } from '@mochi/common'
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
  FilePlus,
  History,
  Library,
  Pencil,
  Plus,
  Search,
  Settings,
  Tags,
} from 'lucide-react'
import { toast } from 'sonner'
import { APP_ROUTES } from '@/config/routes'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext, usePermissions } from '@/context/wiki-context'
import { useAddBookmark } from '@/hooks/use-wiki'

// Non-page routes that shouldn't show page menu
const NON_PAGE_ROUTES = new Set(['search', 'tags', 'tag', 'changes', 'new', 'settings', 'join', 'redirects', 'user', 'system'])

// Class-level routes that aren't entity IDs (same as in lib/common app-path.ts)
const CLASS_ROUTES = new Set([
  'new', 'create', 'list', 'info', 'assets', 'images', 'search',
  'user', 'system', 'domains', 'errors',
  'invitations',
  'join', 'tags', 'changes', 'redirects', 'settings',
])

// Extract entity ID from the browser URL as a fallback
// URL pattern: /<app>/<entity>/<page> (e.g., /wikis/abc123/home)
function getEntityIdFromUrl(): string | null {
  const fullPath = window.location.pathname
  const match = fullPath.match(/^\/[^/]+\/([^/]+)/)
  if (match && match[1] && !CLASS_ROUTES.has(match[1])) {
    return match[1]
  }
  return null
}

function WikiLayoutInner() {
  const { pageTitle, bookmarkDialogOpen, openBookmarkDialog, closeBookmarkDialog } = useSidebarContext()
  const { info } = useWikiContext()
  const permissions = usePermissions()
  const [bookmarkTarget, setBookmarkTarget] = useState('')
  const addBookmark = useAddBookmark()
  const pathname = useLocation({ select: (location) => location.pathname })

  // Derive page slug from pathname - more reliable than useEffect timing
  // Pathname format: /{page}, /{page}/edit, /{page}/history, etc.
  // When at root ("/"), use the wiki's configured home page
  const firstSegment = pathname.split('/')[1] || ''
  const pageSlugFromPath = NON_PAGE_ROUTES.has(firstSegment) ? null : firstSegment || null
  const pageSlug = pageSlugFromPath || (pathname === '/' ? info?.wiki?.home : null) || null

  // Whether we're inside a specific wiki (entity context)
  // Use URL-based detection as fallback when wiki context is temporarily unavailable
  const urlEntityId = getEntityIdFromUrl()
  const isInWiki = (info?.entity && info?.wiki) || urlEntityId !== null
  const wikiName = info?.wiki?.name

  // Detect utility pages (search, tags, recent changes) where no wiki should be expanded
  const isUtilityPage = pathname === '/search' || pathname === '/tags' || pathname === '/changes'

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
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to bookmark wiki')
      },
    })
  }

  const sidebarData: SidebarData = useMemo(() => {
    // Get current wiki ID for highlighting
    // Use URL-based entity ID as fallback when wiki context is temporarily unavailable
    const currentWikiId = info?.wiki?.id || urlEntityId

    // Build page sub-item with Edit and History (nested collapsible)
    const pageSubItem = pageSlug ? {
      title: pageTitle || pageSlug,
      url: `/${pageSlug}` as const,
      icon: FilePlus,
      items: [
        ...(permissions.edit ? [{
          title: 'Edit',
          url: `/${pageSlug}/edit` as const,
          icon: Pencil,
        }] : []),
        {
          title: 'History',
          url: `/${pageSlug}/history` as const,
          icon: History,
        },
      ],
      open: true, // Page submenu always open when viewing a page
    } : null

    // Build wiki sub-items: current page, new page, then settings at bottom
    const buildWikiSubItems = () => [
      ...(pageSubItem ? [pageSubItem] : []),
      ...(permissions.edit
        ? [{ title: 'New page', url: APP_ROUTES.WIKI.NEW, icon: FilePlus }]
        : []),
      ...(permissions.manage
        ? [{ title: 'Wiki settings', url: APP_ROUTES.WIKI.SETTINGS, icon: Settings }]
        : []),
    ]

    // Build wiki items from the list (when in class context)
    // Only expand current wiki when not on a utility page
    const wikiItems = (info?.wikis || []).map((wiki) => {
      const isCurrentWiki = currentWikiId === wiki.id
      const shouldExpand = isCurrentWiki && !isUtilityPage
      return {
        title: wiki.name,
        url: `${getAppPath()}/${wiki.id}` as const,
        icon: BookOpen,
        external: true,
        items: isCurrentWiki ? buildWikiSubItems() : [],
        open: shouldExpand, // Only expand current wiki when viewing wiki pages
      }
    }).sort((a, b) => a.title.localeCompare(b.title))

    // Build bookmarked wiki items
    const bookmarkItems = (info?.bookmarks || []).map((bookmark) => ({
      title: bookmark.name,
      url: `${getAppPath()}/${bookmark.id}` as const,
      icon: Bookmark,
      external: true,
    })).sort((a, b) => a.title.localeCompare(b.title))

    // Build current wiki item when in entity context but not in the wikis list
    // (This handles when we're viewing a wiki that might not be in our class list)
    const currentWikiInList = info?.wikis?.some(w => w.id === currentWikiId)
    const standaloneWikiItem = isInWiki && !currentWikiInList ? {
      title: wikiName || 'Wiki',
      url: APP_ROUTES.WIKI.HOME,
      icon: BookOpen,
      items: buildWikiSubItems(),
      open: !isUtilityPage, // Only expand when not on utility pages
    } : null

    // Build "All wikis" item with submenu for wiki management actions
    // Collapse when inside a specific wiki
    const allWikisItem = {
      title: 'All wikis',
      url: getAppPath() + '/',
      icon: Library,
      external: true,
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
  }, [pageSlug, pageTitle, permissions.edit, permissions.manage, openBookmarkDialog, isInWiki, wikiName, info, isUtilityPage, pathname, urlEntityId])

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
