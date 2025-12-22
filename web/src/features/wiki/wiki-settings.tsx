import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Settings,
  Save,
  Trash2,
  Plus,
  X,
  Shield,
  CornerDownRight,
  ArrowRight,
  Home,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  getAppPath,
  Button,
  Input,
  Label,
  Skeleton,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  AccessDialog,
  AccessList,
  type AccessLevel,
  requestHelpers,
} from '@mochi/common'
import endpoints from '@/api/endpoints'
import {
  useWikiSettings,
  useSetWikiSetting,
  useSyncWiki,
  useDeleteWiki,
  useUserSearch,
  useGroups,
  useSubscribers,
  useRemoveSubscriber,
  useRedirects,
  useSetRedirect,
  useDeleteRedirect,
} from '@/hooks/use-wiki'
import { useWikiContext } from '@/context/wiki-context'

type TabId = 'settings' | 'access' | 'redirects' | 'subscribers'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'settings', label: 'Settings', icon: <Home className="h-4 w-4" /> },
  { id: 'redirects', label: 'Redirects', icon: <CornerDownRight className="h-4 w-4" /> },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" /> },
  { id: 'subscribers', label: 'Subscribers', icon: <Users className="h-4 w-4" /> },
]

export function WikiSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('settings')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'access' && <AccessTab />}
        {activeTab === 'redirects' && <RedirectsTab />}
        {activeTab === 'subscribers' && <SubscribersTab />}
      </div>
    </div>
  )
}

function SettingsTab() {
  const { data, isLoading, error } = useWikiSettings()
  const { info } = useWikiContext()
  const setSetting = useSetWikiSetting()
  const syncWiki = useSyncWiki()
  const deleteWiki = useDeleteWiki()

  const [homePage, setHomePage] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (data?.settings) {
      setHomePage(data.settings.home || 'home')
      setHasChanges(false)
    }
  }, [data])

  const handleHomePageChange = (value: string) => {
    setHomePage(value)
    setHasChanges(value !== (data?.settings?.home || 'home'))
  }

  const handleSave = () => {
    setSetting.mutate(
      { name: 'home', value: homePage.trim() || 'home' },
      {
        onSuccess: () => {
          toast.success('Settings saved')
          setHasChanges(false)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to save settings')
        },
      }
    )
  }

  const handleSync = () => {
    syncWiki.mutate(undefined, {
      onSuccess: () => {
        toast.success('Wiki synced successfully')
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to sync wiki')
      },
    })
  }

  const handleDelete = () => {
    deleteWiki.mutate(undefined, {
      onSuccess: () => {
        toast.success('Wiki deleted')
        window.location.href = getAppPath() + '/'
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete wiki')
      },
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <div className="text-destructive">
        Error loading settings: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {info?.wiki && (
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Unique identifiers for this wiki.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                <dt className="text-muted-foreground w-28 shrink-0">Entity</dt>
                <dd className="font-mono text-xs break-all">{info.wiki.id}</dd>
              </div>
              {info.fingerprint && (
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                  <dt className="text-muted-foreground w-28 shrink-0">Fingerprint</dt>
                  <dd className="font-mono text-xs">{info.fingerprint}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {data?.settings?.source && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              This wiki is subscribed to a source wiki and receives updates from it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="text-muted-foreground w-28 shrink-0">Source</dt>
              <dd className="font-mono text-xs break-all">{data.settings.source}</dd>
            </div>
            <Button onClick={handleSync} disabled={syncWiki.isPending}>
              <RefreshCw className={cn("mr-2 h-4 w-4", syncWiki.isPending && "animate-spin")} />
              {syncWiki.isPending ? 'Syncing...' : 'Sync now'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Home page</CardTitle>
          <CardDescription>
            The page that users see when they first visit the wiki.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="home-page">Use as home</Label>
            <Input
              id="home-page"
              value={homePage}
              onChange={(e) => handleHomePageChange(e.target.value)}
              placeholder="home"
            />
            <p className="text-muted-foreground text-sm">
              Example: "home", "welcome", "index"
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!hasChanges || setSetting.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {setSetting.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete wiki</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this wiki and all its contents. This cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={deleteWiki.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteWiki.isPending ? 'Deleting...' : 'Delete wiki'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the wiki
                    and all its contents.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete wiki
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Wiki access levels (hierarchical: edit > view > none)
const WIKI_ACCESS_LEVELS: AccessLevel[] = [
  { value: 'edit', label: 'Edit and view' },
  { value: 'view', label: 'View only' },
  { value: 'none', label: 'No access' },
]

function AccessTab() {
  const { data: groupsData } = useGroups()

  const [rules, setRules] = useState<import('@/types/wiki').AccessRule[]>([])
  const [owner, setOwner] = useState<import('@/types/wiki').AccessOwner | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const { data: userSearchData, isLoading: userSearchLoading } = useUserSearch(userSearchQuery)

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<import('@/types/wiki').AccessListResponse>(
        endpoints.wiki.access
      )
      setRules(response?.rules ?? [])
      setOwner(response?.owner ?? null)
    } catch (err) {
      console.error('[AccessTab] Failed to load rules', err)
      setError(err instanceof Error ? err : new Error('Failed to load access rules'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (subject: string, subjectName: string, level: string) => {
    try {
      await requestHelpers.post(endpoints.wiki.accessSet, { subject, level })
      toast.success(`Access set for ${subjectName}`)
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to set access level', err)
      toast.error('Failed to set access level')
      throw err
    }
  }

  const handleLevelChange = async (subject: string, level: string) => {
    try {
      await requestHelpers.post(endpoints.wiki.accessSet, { subject, level })
      toast.success('Access updated')
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to update access level', err)
      toast.error('Failed to update access level')
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await requestHelpers.post(endpoints.wiki.accessRevoke, { subject })
      toast.success('Access removed')
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to revoke access', err)
      toast.error('Failed to remove access')
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Add access button - right aligned */}
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        <AccessDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAdd={handleAdd}
          levels={WIKI_ACCESS_LEVELS}
          defaultLevel="edit"
          userSearchResults={userSearchData?.results ?? []}
          userSearchLoading={userSearchLoading}
          onUserSearch={setUserSearchQuery}
          groups={groupsData?.groups ?? []}
        />

        <AccessList
          rules={rules}
          levels={WIKI_ACCESS_LEVELS}
          onLevelChange={handleLevelChange}
          onRevoke={handleRevoke}
          isLoading={isLoading}
          error={error}
          owner={owner}
        />
      </CardContent>
    </Card>
  )
}

function SubscribersTab() {
  const { data, isLoading, error } = useSubscribers()
  const { info } = useWikiContext()
  const removeSubscriber = useRemoveSubscriber()

  // Don't show subscribers tab for subscriber wikis (only source wikis have subscribers)
  if (info?.wiki && data?.subscribers.length === 0) {
    // Check if this is a subscriber wiki
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
          <CardDescription>
            Other wikis that have subscribed to receive updates from this wiki.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No subscribers yet. When other wikis subscribe to this wiki, they will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleRemove = (subscriberId: string, name: string) => {
    removeSubscriber.mutate(subscriberId, {
      onSuccess: () => {
        toast.success(`Subscriber "${name || subscriberId.slice(0, 12)}..." removed`)
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to remove subscriber')
      },
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading subscribers: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  const subscribers = data?.subscribers || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscribers</CardTitle>
        <CardDescription>
          Other wikis that have subscribed to receive updates from this wiki.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscribers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Subscribed</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-xs">
                    {sub.id.slice(0, 20)}...
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(sub.subscribed * 1000), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.seen > 0
                      ? format(new Date(sub.seen * 1000), 'yyyy-MM-dd HH:mm:ss')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={removeSubscriber.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove subscriber?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will stop sending updates to "{sub.name || sub.id.slice(0, 16)}...".
                            They can subscribe again if they want.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(sub.id, sub.name)}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            No subscribers yet. When other wikis subscribe to this wiki, they will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RedirectsTab() {
  const { data, isLoading, error } = useRedirects()
  const deleteRedirect = useDeleteRedirect()

  const handleDelete = (source: string) => {
    deleteRedirect.mutate(source, {
      onSuccess: () => {
        toast.success(`Redirect "${source}" deleted`)
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete redirect')
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Redirects</CardTitle>
            <CardDescription>
              Manage URL redirects for your wiki. Redirects allow old or alternative
              URLs to point to existing pages.
            </CardDescription>
          </div>
          <AddRedirectDialog />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">
            Error loading redirects: {error.message}
          </div>
        ) : !data?.redirects || data.redirects.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No redirects configured. Create a redirect to forward one URL to another.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead></TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.redirects.map((redirect) => (
                <TableRow key={redirect.source}>
                  <TableCell className="font-mono">{redirect.source}</TableCell>
                  <TableCell>
                    <ArrowRight className="text-muted-foreground h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <a href={redirect.target} className="font-mono hover:underline">
                      {redirect.target}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(redirect.created * 1000), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete redirect?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the redirect from "{redirect.source}" to "
                            {redirect.target}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(redirect.source)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function AddRedirectDialog() {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const setRedirect = useSetRedirect()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!source.trim() || !target.trim()) {
      toast.error('Both source and target are required')
      return
    }

    setRedirect.mutate(
      { source: source.trim(), target: target.trim() },
      {
        onSuccess: () => {
          toast.success('Redirect created')
          setSource('')
          setTarget('')
          setOpen(false)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create redirect')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add redirect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create redirect</DialogTitle>
            <DialogDescription>
              Create a redirect from one URL to another.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source">Source URL</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="old-page-name"
              />
              <p className="text-muted-foreground text-sm">
                The URL that will be redirected
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target URL</Label>
              <Input
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="new-page-name"
              />
              <p className="text-muted-foreground text-sm">
                The existing page to redirect to
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={setRedirect.isPending}>
              {setRedirect.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WikiSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex gap-1 border-b">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
