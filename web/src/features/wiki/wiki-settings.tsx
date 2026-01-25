import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from '@mochi/common'
import {
  ArrowRight,
  Check,
  CornerDownRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
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
  getErrorMessage,
} from '@mochi/common'
import endpoints from '@/api/endpoints'
import {
  useWikiSettings,
  useSetWikiSetting,
  useSyncWiki,
  useDeleteWiki,
  useUserSearch,
  useGroups,
} from '@/hooks/use-wiki'
import { useWikiContext } from '@/context/wiki-context'
import type { WikiPermissions } from '@/types/wiki'
import { createContext, useContext } from 'react'

export type WikiSettingsTabId = 'settings' | 'access' | 'redirects' | 'replicas'

interface Tab {
  id: WikiSettingsTabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  { id: 'redirects', label: 'Redirects', icon: <CornerDownRight className="h-4 w-4" /> },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" /> },
  { id: 'replicas', label: 'Replicas', icon: <Users className="h-4 w-4" /> },
]

// Context for wiki-specific settings when accessed via /$wikiId/settings route
interface WikiSettingsContextValue {
  baseURL: string | null
  wiki: { id: string; name: string; home: string; fingerprint?: string } | null
  permissions: WikiPermissions
}

const WikiSettingsContext = createContext<WikiSettingsContextValue>({
  baseURL: null,
  wiki: null,
  permissions: { view: false, edit: false, delete: false, manage: false },
})

function useSettingsContext() {
  return useContext(WikiSettingsContext)
}

interface WikiSettingsProps {
  activeTab: WikiSettingsTabId
  onTabChange: (tab: WikiSettingsTabId) => void
  // Optional props for wiki-specific context (used in /$wikiId/settings route)
  baseURL?: string
  wiki?: { id: string; name: string; home: string; fingerprint?: string }
  permissions?: WikiPermissions
}

export function WikiSettings({ activeTab, onTabChange, baseURL, wiki, permissions }: WikiSettingsProps) {
  const contextValue: WikiSettingsContextValue = {
    baseURL: baseURL ?? null,
    wiki: wiki ?? null,
    permissions: permissions ?? { view: false, edit: false, delete: false, manage: false },
  }

  return (
    <WikiSettingsContext.Provider value={contextValue}>
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
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
        {activeTab === 'replicas' && <ReplicasTab />}
      </div>
    </div>
    </WikiSettingsContext.Provider>
  )
}

// Characters disallowed in wiki names (matches backend validation)
const DISALLOWED_NAME_CHARS = /[<>\r\n\\;"'`]/

function SettingsTab() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const settingsContext = useSettingsContext()

  // Always call hooks (React rules), but use settings context values when provided
  const wikiContextResult = useWikiContext()
  const wikiInfo = settingsContext.wiki ?? wikiContextResult?.info?.wiki
  const fingerprint = settingsContext.wiki?.fingerprint ?? wikiContextResult?.info?.fingerprint

  // These hooks are used when in entity context (no baseURL)
  const defaultSettings = useWikiSettings()
  const setSetting = useSetWikiSetting()
  const syncWiki = useSyncWiki()
  const deleteWiki = useDeleteWiki()

  // State for wiki-specific API calls when baseURL is provided
  const [wikiSpecificData, setWikiSpecificData] = useState<{ settings?: { home?: string; source?: string } } | null>(null)
  const [wikiSpecificLoading, setWikiSpecificLoading] = useState(false)
  const [wikiSpecificError, setWikiSpecificError] = useState<Error | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load settings using baseURL when provided
  useEffect(() => {
    if (settingsContext.baseURL) {
      setWikiSpecificLoading(true)
      requestHelpers.get<{ settings: { home?: string; source?: string } }>(`${settingsContext.baseURL}settings`)
        .then(data => {
          setWikiSpecificData(data)
          setWikiSpecificError(null)
        })
        .catch(err => setWikiSpecificError(err))
        .finally(() => setWikiSpecificLoading(false))
    }
  }, [settingsContext.baseURL])

  // Use the appropriate data source
  const data = settingsContext.baseURL ? wikiSpecificData : defaultSettings.data
  const isLoading = settingsContext.baseURL ? wikiSpecificLoading : defaultSettings.isLoading
  const error = settingsContext.baseURL ? wikiSpecificError : defaultSettings.error

  const [homePage, setHomePage] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Inline edit state for name
  const [currentName, setCurrentName] = useState(wikiInfo?.name || '')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (data?.settings) {
      setHomePage(data.settings.home || 'home')
      setHasChanges(false)
    }
  }, [data])

  // Sync name from context
  useEffect(() => {
    if (wikiInfo?.name) {
      setCurrentName(wikiInfo.name)
    }
  }, [wikiInfo?.name])

  const validateName = (n: string): string | null => {
    if (!n.trim()) return 'Wiki name is required'
    if (n.length > 100) return 'Name must be 100 characters or less'
    if (DISALLOWED_NAME_CHARS.test(n)) return 'Name cannot contain < > \\ ; " \' or ` characters'
    return null
  }

  const handleStartEditName = () => {
    setEditName(currentName || '')
    setNameError(null)
    setIsEditingName(true)
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setEditName(currentName || '')
    setNameError(null)
  }

  const handleSaveEditName = async () => {
    const trimmedName = editName.trim()
    const validationError = validateName(trimmedName)
    if (validationError) {
      setNameError(validationError)
      return
    }
    if (trimmedName === currentName) {
      setIsEditingName(false)
      return
    }
    setIsRenaming(true)
    try {
      const url = settingsContext.baseURL
        ? `${settingsContext.baseURL}${endpoints.wiki.rename}`
        : endpoints.wiki.rename
      await requestHelpers.post(url, { name: trimmedName })
      setCurrentName(trimmedName)
      toast.success('Wiki renamed')
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
      setIsEditingName(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to rename wiki'))
    } finally {
      setIsRenaming(false)
    }
  }

  const handleHomePageChange = (value: string) => {
    setHomePage(value)
    setHasChanges(value !== (data?.settings?.home || 'home'))
  }

  const handleSave = async () => {
    if (settingsContext.baseURL) {
      // Use direct API call with baseURL
      setIsSaving(true)
      try {
        await requestHelpers.post(`${settingsContext.baseURL}${endpoints.wiki.settingsSet}`, {
          name: 'home',
          value: homePage.trim() || 'home',
        })
        toast.success('Settings saved')
        setHasChanges(false)
        queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to save settings'))
      } finally {
        setIsSaving(false)
      }
    } else {
      setSetting.mutate(
        { name: 'home', value: homePage.trim() || 'home' },
        {
          onSuccess: () => {
            toast.success('Settings saved')
            setHasChanges(false)
          },
          onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to save settings'))
          },
        }
      )
    }
  }

  const handleSync = async () => {
    if (settingsContext.baseURL) {
      setIsSyncing(true)
      try {
        await requestHelpers.post(`${settingsContext.baseURL}${endpoints.wiki.sync}`, {})
        toast.success('Wiki synced')
        queryClient.invalidateQueries({ queryKey: ['wiki'] })
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to sync wiki'))
      } finally {
        setIsSyncing(false)
      }
    } else {
      syncWiki.mutate(undefined, {
        onSuccess: () => {
          toast.success('Wiki synced')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to sync wiki'))
        },
      })
    }
  }

  const handleDelete = async () => {
    if (settingsContext.baseURL) {
      setIsDeleting(true)
      try {
        await requestHelpers.post(`${settingsContext.baseURL}${endpoints.wiki.delete}`, {})
        toast.success('Wiki deleted')
        void navigate({ to: '/' })
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to delete wiki'))
      } finally {
        setIsDeleting(false)
      }
    } else {
      deleteWiki.mutate(undefined, {
        onSuccess: () => {
          toast.success('Wiki deleted')
          void navigate({ to: '/' })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to delete wiki'))
        },
      })
    }
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

  // Use appropriate pending state
  const savePending = settingsContext.baseURL ? isSaving : setSetting.isPending
  const syncPending = settingsContext.baseURL ? isSyncing : syncWiki.isPending
  const deletePending = settingsContext.baseURL ? isDeleting : deleteWiki.isPending

  return (
    <div className="space-y-6">
      {wikiInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Unique identifiers for this wiki.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-4 sm:items-center">
                <dt className="text-muted-foreground w-28 shrink-0">Name</dt>
                <dd className="flex-1">
                  {isEditingName ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value)
                            setNameError(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveEditName()
                            if (e.key === 'Escape') handleCancelEditName()
                          }}
                          className="h-8"
                          disabled={isRenaming}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleSaveEditName()}
                          disabled={isRenaming}
                          className="h-8 w-8 p-0"
                        >
                          {isRenaming ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEditName}
                          disabled={isRenaming}
                          className="h-8 w-8 p-0"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      {nameError && (
                        <span className="text-sm text-destructive">{nameError}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{currentName}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleStartEditName}
                        className="h-6 w-6 p-0"
                      >
                        <Pencil className="size-3" />
                      </Button>
                    </div>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                <dt className="text-muted-foreground w-28 shrink-0">Entity</dt>
                <dd className="font-mono text-xs break-all">{wikiInfo.id}</dd>
              </div>
              {fingerprint && (
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                  <dt className="text-muted-foreground w-28 shrink-0">Fingerprint</dt>
                  <dd className="font-mono text-xs">{fingerprint}</dd>
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
            <Button variant="outline" onClick={() => void handleSync()} disabled={syncPending}>
              <RefreshCw className={cn("mr-2 h-4 w-4", syncPending && "animate-spin")} />
              {syncPending ? 'Syncing...' : 'Sync now'}
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
            <Button onClick={() => void handleSave()} disabled={!hasChanges || savePending}>
              <Save className="mr-2 h-4 w-4" />
              {savePending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Only show delete option for owned wikis (not subscribed) */}
      {!data?.settings?.source && (
        <Card>
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
                  <Button variant="outline" disabled={deletePending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletePending ? 'Deleting...' : 'Delete wiki'}
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
                    <AlertDialogAction onClick={() => void handleDelete()}>
                      Delete wiki
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
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
  const settingsContext = useSettingsContext()

  const [rules, setRules] = useState<import('@/types/wiki').AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const { data: userSearchData, isLoading: userSearchLoading } = useUserSearch(userSearchQuery)

  // Helper to build API URL with optional baseURL
  const apiUrl = (endpoint: string) =>
    settingsContext.baseURL ? `${settingsContext.baseURL}${endpoint}` : endpoint

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<import('@/types/wiki').AccessListResponse>(
        apiUrl(endpoints.wiki.access)
      )
      setRules(response?.rules ?? [])
    } catch (err) {
      console.error('[AccessTab] Failed to load rules', err)
      setError(err instanceof Error ? err : new Error('Failed to load access rules'))
    } finally {
      setIsLoading(false)
    }
  }, [settingsContext.baseURL])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (subject: string, subjectName: string, level: string) => {
    try {
      await requestHelpers.post(apiUrl(endpoints.wiki.accessSet), { subject, level })
      toast.success(`Access set for ${subjectName}`)
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to set access level', err)
      toast.error(getErrorMessage(err, 'Failed to set access level'))
      throw err
    }
  }

  const handleLevelChange = async (subject: string, level: string) => {
    try {
      await requestHelpers.post(apiUrl(endpoints.wiki.accessSet), { subject, level })
      toast.success('Access updated')
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to update access level', err)
      toast.error(getErrorMessage(err, 'Failed to update access level'))
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await requestHelpers.post(apiUrl(endpoints.wiki.accessRevoke), { subject })
      toast.success('Access removed')
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to revoke access', err)
      toast.error(getErrorMessage(err, 'Failed to remove access'))
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
        />
      </CardContent>
    </Card>
  )
}

function ReplicasTab() {
  const settingsContext = useSettingsContext()
  const wikiContextResult = useWikiContext()
  const wikiInfo = settingsContext.wiki ?? wikiContextResult?.info?.wiki

  // Local state for wiki-specific API calls
  const [replicas, setReplicas] = useState<import('@/hooks/use-wiki').Replica[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // Helper to build API URL with optional baseURL
  const apiUrl = (endpoint: string) =>
    settingsContext.baseURL ? `${settingsContext.baseURL}${endpoint}` : endpoint

  const loadReplicas = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<{ replicas: import('@/hooks/use-wiki').Replica[] }>(
        apiUrl(endpoints.wiki.replicas)
      )
      setReplicas(response?.replicas ?? [])
    } catch (err) {
      console.error('[ReplicasTab] Failed to load replicas', err)
      setError(err instanceof Error ? err : new Error('Failed to load replicas'))
    } finally {
      setIsLoading(false)
    }
  }, [settingsContext.baseURL])

  useEffect(() => {
    void loadReplicas()
  }, [loadReplicas])

  const handleRemove = async (replicaId: string, name: string) => {
    setIsRemoving(true)
    try {
      await requestHelpers.post(apiUrl(endpoints.wiki.replicaRemove), {
        replica: replicaId,
      })
      toast.success(`Replica "${name || replicaId.slice(0, 12)}..." removed`)
      void loadReplicas()
    } catch (err) {
      console.error('[ReplicasTab] Failed to remove replica', err)
      toast.error(getErrorMessage(err, 'Failed to remove replica'))
    } finally {
      setIsRemoving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Replicas</CardTitle>
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
          <CardTitle>Replicas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading replicas: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  // Show empty state for wikis with no replicas
  if (wikiInfo && replicas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Replicas</CardTitle>
          <CardDescription>
            Other wikis that replicate content from this wiki.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No replicas yet. When other wikis replicate this wiki, they will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Replicas</CardTitle>
        <CardDescription>
          Other wikis that replicate content from this wiki.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {replicas.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Subscribed</TableHead>
                <TableHead>Last synced</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replicas.map((replica) => (
                <TableRow key={replica.id}>
                  <TableCell className="font-mono text-xs">
                    {replica.id.slice(0, 20)}...
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(replica.subscribed * 1000), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {replica.synced > 0
                      ? format(new Date(replica.synced * 1000), 'yyyy-MM-dd HH:mm')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isRemoving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove replica?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will stop sending updates to "{replica.name || replica.id.slice(0, 16)}...".
                            They can replicate again if they want.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void handleRemove(replica.id, replica.name)}
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
            No replicas yet. When other wikis replicate this wiki, they will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RedirectsTab() {
  const settingsContext = useSettingsContext()

  // Local state for wiki-specific API calls
  const [redirects, setRedirects] = useState<import('@/types/wiki').Redirect[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Helper to build API URL with optional baseURL
  const apiUrl = (endpoint: string) =>
    settingsContext.baseURL ? `${settingsContext.baseURL}${endpoint}` : endpoint

  const loadRedirects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<import('@/types/wiki').RedirectsResponse>(
        apiUrl(endpoints.wiki.redirects)
      )
      setRedirects(response?.redirects ?? [])
    } catch (err) {
      console.error('[RedirectsTab] Failed to load redirects', err)
      setError(err instanceof Error ? err : new Error('Failed to load redirects'))
    } finally {
      setIsLoading(false)
    }
  }, [settingsContext.baseURL])

  useEffect(() => {
    void loadRedirects()
  }, [loadRedirects])

  const handleDelete = async (source: string) => {
    setIsDeleting(true)
    try {
      await requestHelpers.post(apiUrl(endpoints.wiki.redirectDelete), { source })
      toast.success(`Redirect "${source}" deleted`)
      void loadRedirects()
    } catch (err) {
      console.error('[RedirectsTab] Failed to delete redirect', err)
      toast.error(getErrorMessage(err, 'Failed to delete redirect'))
    } finally {
      setIsDeleting(false)
    }
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
          <AddRedirectDialog baseURL={settingsContext.baseURL} onSuccess={loadRedirects} />
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
        ) : redirects.length === 0 ? (
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
              {redirects.map((redirect) => (
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
                          disabled={isDeleting}
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
                            onClick={() => void handleDelete(redirect.source)}
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

interface AddRedirectDialogProps {
  baseURL: string | null
  onSuccess: () => void
}

function AddRedirectDialog({ baseURL, onSuccess }: AddRedirectDialogProps) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Helper to build API URL with optional baseURL
  const apiUrl = (endpoint: string) =>
    baseURL ? `${baseURL}${endpoint}` : endpoint

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!source.trim() || !target.trim()) {
      toast.error('Both source and target are required')
      return
    }

    setIsCreating(true)
    try {
      await requestHelpers.post(apiUrl(endpoints.wiki.redirectSet), {
        source: source.trim(),
        target: target.trim(),
      })
      toast.success('Redirect created')
      setSource('')
      setTarget('')
      setOpen(false)
      onSuccess()
    } catch (err) {
      console.error('[AddRedirectDialog] Failed to create redirect', err)
      toast.error(getErrorMessage(err, 'Failed to create redirect'))
    } finally {
      setIsCreating(false)
    }
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
        <form onSubmit={(e) => void handleSubmit(e)}>
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
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : <><Plus className="h-4 w-4 mr-2" />Create redirect</>}
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
