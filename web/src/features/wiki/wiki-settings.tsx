// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type {
  AccessListResponse,
  AccessRule,
  WikiPermissions,
} from '@/types/wiki'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DataChip,
  EditableFieldRow,
  EmptyState,
  FieldRow,
  GeneralError,
  Input,
  Label,
  ListSkeleton,
  Section,
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
  ConfirmDialog,
  Dialog,
  DialogContent,
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  AccessDialog,
  AccessList,
  type AccessLevel,
  toast,
  toastAction,
  requestHelpers,
  getErrorMessage,
  useFormat,
  naturalCompare,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DISALLOWED_NAME_CHARS,
} from '@mochi/web'
import {
  ArrowRight,
  Check,
  CornerDownRight,
  Minus,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import endpoints from '@/api/endpoints'
import { useWikiContext } from '@/context/wiki-context'
import {
  type Replica,
  useEntityEndpoint,
  useWikiSettings,
  useSetWikiSetting,
  useSyncWiki,
  useDeleteWiki,
  useUserSearch,
  useGroups,
} from '@/hooks/use-wiki'
import { ValueLinkChip } from '@/components/value-link-chip'

export type WikiSettingsTabId = 'settings' | 'access' | 'redirects' | 'replicas'

interface Tab {
  id: WikiSettingsTabId
  label: string
  icon: React.ReactNode
}

function useTabs(): Tab[] {
  const { t } = useLingui()
  return useMemo(
    () => [
      {
        id: 'settings' as const,
        label: t`Settings`,
        icon: <Settings className='h-4 w-4' />,
      },
      {
        id: 'redirects' as const,
        label: t`Redirects`,
        icon: <CornerDownRight className='h-4 w-4' />,
      },
      {
        id: 'access' as const,
        label: t`Access`,
        icon: <Shield className='h-4 w-4' />,
      },
      {
        id: 'replicas' as const,
        label: t`Replicas`,
        icon: <Users className='h-4 w-4' />,
      },
    ],
    [t]
  )
}

// Context for wiki-specific settings when accessed via /$wikiId/settings route
interface WikiSettingsContextValue {
  wiki: {
    id: string
    name: string
    home: string
    fingerprint?: string
    source?: string
  } | null
  permissions: WikiPermissions
}

const WikiSettingsContext = createContext<WikiSettingsContextValue>({
  wiki: null,
  permissions: {
    view: false,
    edit: false,
    delete: false,
    manage: false,
    owner: false,
  },
})

function useSettingsContext() {
  return useContext(WikiSettingsContext)
}

interface WikiSettingsProps {
  activeTab: WikiSettingsTabId
  onTabChange: (tab: WikiSettingsTabId) => void
  // Optional props for wiki-specific context (used in /$wikiId/settings route)
  wiki?: {
    id: string
    name: string
    home: string
    fingerprint?: string
    source?: string
  }
  permissions?: WikiPermissions
}

export function WikiSettings({
  activeTab,
  onTabChange,
  wiki,
  permissions,
}: WikiSettingsProps) {
  const { t } = useLingui()
  const tabs = useTabs()
  const contextValue: WikiSettingsContextValue = {
    wiki: wiki ?? null,
    permissions: permissions ?? {
      view: false,
      edit: false,
      delete: false,
      manage: false,
      owner: false,
    },
  }

  // Hide Replicas tab for replica wikis (they don't have replicas of their own)
  const visibleTabs = wiki?.source
    ? tabs.filter((tab) => tab.id !== 'replicas')
    : tabs

  return (
    <WikiSettingsContext.Provider value={contextValue}>
      <Tabs
        variant='underline'
        value={activeTab}
        onValueChange={(value) => onTabChange(value as WikiSettingsTabId)}
        className='space-y-6'
      >
        <TabsList aria-label={t`Wiki settings sections`}>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className='gap-2'>
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value='settings' className='pt-2'>
          <SettingsTab />
        </TabsContent>
        <TabsContent value='access' className='pt-2'>
          <AccessTab />
        </TabsContent>
        <TabsContent value='redirects' className='pt-2'>
          <RedirectsTab />
        </TabsContent>
        {!wiki?.source && (
          <TabsContent value='replicas' className='pt-2'>
            <ReplicasTab />
          </TabsContent>
        )}
      </Tabs>
    </WikiSettingsContext.Provider>
  )
}

function SettingsTab() {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const settingsContext = useSettingsContext()

  // Always call hooks (React rules), but use settings context values when provided
  const wikiContextResult = useWikiContext()
  const wikiInfo = settingsContext.wiki ?? wikiContextResult?.info?.wiki
  const fingerprint =
    settingsContext.wiki?.fingerprint ?? wikiContextResult?.info?.fingerprint

  const e = useEntityEndpoint()
  // One data source. The wiki's base URL is resolved by useEntityEndpoint
  // from the route's provider, so the hooks reach the right wiki in both
  // routing contexts; the hand-rolled useState/useEffect fetch this file used
  // to run alongside them existed only because the base URL was passed in as a
  // prop, and it carried no caching, no invalidation and its own error state.
  const { data, isLoading, error, refetch: retrySettings } = useWikiSettings()
  const setSetting = useSetWikiSetting()
  const syncWiki = useSyncWiki()
  const deleteWiki = useDeleteWiki()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const [homePage, setHomePage] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Current name, kept in sync with the wiki context for the inline editor.
  const [currentName, setCurrentName] = useState(wikiInfo?.name || '')

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
    const trimmed = n.trim()
    if (!trimmed) return t`Wiki name is required`
    if (trimmed.length > 100) return t`Name must be 100 characters or less`
    if (DISALLOWED_NAME_CHARS.test(trimmed))
      return t`Name cannot contain < or > characters, or line breaks`
    return null
  }

  const handleRenameWiki = async (trimmedName: string) => {
    await toastAction(
      requestHelpers.post(e(endpoints.wiki.rename), { name: trimmedName }),
      {
        loading: t`Saving...`,
        success: t`Wiki renamed`,
        error: (err) => getErrorMessage(err, t`Failed to rename wiki`),
      }
    )
    setCurrentName(trimmedName)
    void queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
  }

  const handleHomePageChange = (value: string) => {
    setHomePage(value)
    setHasChanges(value !== (data?.settings?.home || 'home'))
  }

  const handleSave = async () => {
    try {
      await toastAction(
        setSetting.mutateAsync({
          name: 'home',
          value: homePage.trim() || 'home',
        }),
        {
          loading: t`Saving...`,
          success: t`Settings saved`,
          error: (err) => getErrorMessage(err, t`Failed to save settings`),
        }
      )
      setHasChanges(false)
      void queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    } catch {
      // toast already shown
    }
  }

  const handleSync = async () => {
    try {
      await toastAction(syncWiki.mutateAsync(), {
        loading: t`Syncing...`,
        success: t`Wiki synced`,
        error: (err) => getErrorMessage(err, t`Failed to sync wiki`),
      })
      void queryClient.invalidateQueries({ queryKey: ['wiki'] })
    } catch {
      // toast already shown
    }
  }

  const handleDelete = async () => {
    try {
      await toastAction(deleteWiki.mutateAsync(), {
        loading: t`Deleting wiki...`,
        success: t`Wiki deleted`,
        error: (err) => getErrorMessage(err, t`Failed to delete wiki`),
      })
      setDeleteConfirmOpen(false)
      void navigate({ to: '/' })
    } catch {
      // toast already shown
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-4 w-96' />
        </CardHeader>
        <CardContent>
          <ListSkeleton variant='simple' height='h-10' count={2} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <GeneralError error={error} minimal mode='inline' reset={retrySettings} />
    )
  }

  const savePending = setSetting.isPending
  const syncPending = syncWiki.isPending
  const deletePending = deleteWiki.isPending

  return (
    <div className='space-y-6'>
      {wikiInfo && (
        <Section title={t`Identity`}>
          <div className='divide-y-0'>
            <EditableFieldRow
              label={t`Name`}
              value={currentName}
              onSave={handleRenameWiki}
              validate={validateName}
              emphasize
            />
            <FieldRow label={t`Entity ID`}>
              <DataChip value={wikiInfo.id} truncate='middle' />
            </FieldRow>
            {fingerprint && (
              <FieldRow label={t`Fingerprint`}>
                <DataChip value={fingerprint} truncate='middle' />
              </FieldRow>
            )}
          </div>
        </Section>
      )}

      {data?.settings?.source && (
        <Section
          title={t`Subscription`}
          description={t`This wiki is subscribed to a source wiki and receives updates from it.`}
          action={
            <Button
              variant='outline'
              onClick={() => void handleSync()}
              loading={syncPending}
              icon={<RefreshCw className='me-2 h-4 w-4' />}
            >
              {t`Sync now`}
            </Button>
          }
        >
          <div className='divide-y-0'>
            <FieldRow label={t`Source`}>
              <ValueLinkChip value={data.settings.source} />
            </FieldRow>
          </div>
        </Section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Home page</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>
              The page that users see when they first visit the wiki.
            </Trans>
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='home-page'>
              <Trans>Use as home</Trans>
            </Label>
            <Input
              id='home-page'
              value={homePage}
              onChange={(e) => handleHomePageChange(e.target.value)}
              placeholder={t`home`}
            />
          </div>
          <div className='flex justify-end'>
            <Button
              onClick={() => void handleSave()}
              loading={savePending}
              disabled={!hasChanges}
              icon={<Check className='me-2 h-4 w-4' />}
            >
              {t`Save changes`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Only show delete option for owned wikis (not subscribed) */}
      {!data?.settings?.source && (
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='font-medium'>
                  <Trans>Delete wiki</Trans>
                </p>
              </div>
              <Button
                variant='outline'
                disabled={deletePending}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className='me-2 h-4 w-4' />
                {t`Delete wiki`}
              </Button>
            </div>
            <ConfirmDialog
              open={deleteConfirmOpen}
              onOpenChange={setDeleteConfirmOpen}
              title={t`Are you absolutely sure?`}
              desc={t`This action cannot be undone. This will permanently delete the wiki and all its contents.`}
              confirmText={t`Delete wiki`}
              destructive
              isLoading={deletePending}
              handleConfirm={() => void handleDelete()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Wiki access levels (hierarchical: edit > view > none)
function useWikiAccessLevels(): AccessLevel[] {
  const { t } = useLingui()
  return useMemo(
    () => [
      { value: 'edit', label: t`Edit and view` },
      { value: 'view', label: t`View only` },
      { value: 'none', label: t`No access` },
    ],
    [t]
  )
}

function AccessTab() {
  const { t } = useLingui()
  const accessLevels = useWikiAccessLevels()
  const { data: groupsData } = useGroups()

  const [rules, setRules] = useState<AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const { data: userSearchData, isLoading: userSearchLoading } =
    useUserSearch(userSearchQuery)

  const apiUrl = useEntityEndpoint()

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<AccessListResponse>(
        apiUrl(endpoints.wiki.access)
      )
      setRules(response?.rules ?? [])
    } catch (err) {
      setError(new Error(getErrorMessage(err, t`Failed to load access rules`)))
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, t])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (
    subject: string,
    subjectName: string,
    level: string
  ) => {
    await toastAction(
      requestHelpers.post(apiUrl(endpoints.wiki.accessSet), { subject, level }),
      {
        loading: t`Setting access...`,
        success: t`Access set for ${subjectName}`,
        error: (err) => getErrorMessage(err, t`Failed to set access level`),
      }
    )
    void loadRules()
  }

  const handleLevelChange = async (subject: string, level: string) => {
    try {
      await toastAction(
        requestHelpers.post(apiUrl(endpoints.wiki.accessSet), {
          subject,
          level,
        }),
        {
          loading: t`Updating access...`,
          success: t`Access level updated`,
          error: (err) =>
            getErrorMessage(err, t`Failed to update access level`),
        }
      )
      void loadRules()
    } catch {
      // toast already shown
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await toastAction(
        requestHelpers.post(apiUrl(endpoints.wiki.accessRevoke), { subject }),
        {
          loading: t`Removing access...`,
          success: t`Access removed`,
          error: (err) => getErrorMessage(err, t`Failed to remove access`),
        }
      )
      void loadRules()
    } catch {
      // toast already shown
    }
  }

  return (
    <Card>
      <CardContent className='space-y-4 pt-6'>
        {/* Add access button - right aligned */}
        <div className='flex justify-end'>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className='me-2 h-4 w-4' />
            <Trans>Add</Trans>
          </Button>
        </div>

        <AccessDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAdd={handleAdd}
          levels={accessLevels}
          defaultLevel='edit'
          userSearchResults={userSearchData?.results ?? []}
          userSearchLoading={userSearchLoading}
          onUserSearch={setUserSearchQuery}
          groups={groupsData?.groups ?? []}
        />

        {error ? (
          <GeneralError
            error={error}
            minimal
            mode='inline'
            reset={() => void loadRules()}
          />
        ) : (
          <AccessList
            rules={rules}
            levels={accessLevels}
            onLevelChange={handleLevelChange}
            onRevoke={handleRevoke}
            isLoading={isLoading}
            error={null}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ReplicasTab() {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const settingsContext = useSettingsContext()
  const wikiContextResult = useWikiContext()
  const wikiInfo = settingsContext.wiki ?? wikiContextResult?.info?.wiki

  // Local state for wiki-specific API calls
  const [replicas, setReplicas] = useState<Replica[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const apiUrl = useEntityEndpoint()

  const loadReplicas = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<{ replicas: Replica[] }>(
        apiUrl(endpoints.wiki.replicas)
      )
      setReplicas(response?.replicas ?? [])
    } catch (err) {
      setError(new Error(getErrorMessage(err, t`Failed to load replicas`)))
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, t])

  useEffect(() => {
    void loadReplicas()
  }, [loadReplicas])

  const handleRemove = async (replicaId: string, name: string) => {
    setIsRemoving(true)
    const displayName = name || `${replicaId.slice(0, 12)}...`
    try {
      await toastAction(
        requestHelpers.post(apiUrl(endpoints.wiki.replicaRemove), {
          replica: replicaId,
        }),
        {
          loading: t`Removing replica...`,
          success: t`Replica "${displayName}" removed`,
          error: (err) => getErrorMessage(err, t`Failed to remove replica`),
        }
      )
      void loadReplicas()
    } catch {
      // toast already shown
    } finally {
      setIsRemoving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Replicas</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ListSkeleton variant='simple' height='h-10' count={2} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Replicas</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GeneralError
            error={error}
            minimal
            mode='inline'
            reset={() => void loadReplicas()}
          />
        </CardContent>
      </Card>
    )
  }

  // Show empty state for wikis with no replicas
  if (wikiInfo && replicas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Replicas</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Users}
            title={t`No replicas yet`}
            description={t`When other wikis replicate this wiki, they will appear here.`}
            className='py-6'
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Replicas</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {replicas.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Trans>Name</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Subscribed</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Last synced</Trans>
                </TableHead>
                <TableHead className='w-20'>
                  <Trans>Actions</Trans>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replicas.map((replica) => (
                <TableRow key={replica.id}>
                  <TableCell>
                    <DataChip value={replica.name || t`Unknown`} />
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatTimestamp(replica.subscribed)}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatTimestamp(replica.synced, t`Never`)}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              disabled={isRemoving}
                              aria-label={t`Remove replica ${replica.name || replica.id}`}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{t`Remove replica ${replica.name || replica.id}`}</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            <Trans>Remove replica?</Trans>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <Trans>
                              This will stop sending updates to "
                              {replica.name || `${replica.id.slice(0, 16)}...`}
                              ". They can replicate again if they want.
                            </Trans>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            <Trans>Cancel</Trans>
                          </AlertDialogCancel>
                          <AlertDialogAction
                            loading={isRemoving}
                            icon={<Minus className='h-4 w-4' />}
                            onClick={() =>
                              void handleRemove(replica.id, replica.name)
                            }
                          >
                            <Trans>Remove</Trans>
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
          <EmptyState
            icon={Users}
            title={t`No replicas yet`}
            description={t`When other wikis replicate this wiki, they will appear here.`}
            className='py-6'
          />
        )}
      </CardContent>
    </Card>
  )
}

function RedirectsTab() {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()

  // Local state for wiki-specific API calls
  const [redirects, setRedirects] = useState<import('@/types/wiki').Redirect[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const apiUrl = useEntityEndpoint()

  const loadRedirects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<
        import('@/types/wiki').RedirectsResponse
      >(apiUrl(endpoints.wiki.redirects))
      // The server no longer orders by `source`: it is a user-facing slug, so
      // accents and locale belong to the consumer.
      setRedirects(
        [...(response?.redirects ?? [])].sort((a, b) =>
          naturalCompare(a.source, b.source)
        )
      )
    } catch (err) {
      setError(new Error(getErrorMessage(err, t`Failed to load redirects`)))
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, t])

  useEffect(() => {
    void loadRedirects()
  }, [loadRedirects])

  const handleDelete = async (source: string) => {
    setIsDeleting(true)
    try {
      await toastAction(
        requestHelpers.post(apiUrl(endpoints.wiki.redirectDelete), { source }),
        {
          loading: t`Deleting redirect...`,
          success: t`Redirect "${source}" deleted`,
          error: (err) => getErrorMessage(err, t`Failed to delete redirect`),
        }
      )
      void loadRedirects()
    } catch {
      // toast already shown
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>
            <Trans>Redirects</Trans>
          </CardTitle>
          <AddRedirectDialog onSuccess={loadRedirects} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton variant='simple' height='h-12' count={3} />
        ) : error ? (
          <GeneralError
            error={error}
            minimal
            mode='inline'
            reset={() => void loadRedirects()}
          />
        ) : redirects.length === 0 ? (
          <EmptyState
            icon={CornerDownRight}
            title={t`No redirects configured`}
            description={t`Create a redirect to forward one URL to another.`}
            className='py-6'
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Trans>Source</Trans>
                </TableHead>
                <TableHead></TableHead>
                <TableHead>
                  <Trans>Target</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Created</Trans>
                </TableHead>
                <TableHead className='w-[50px]'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redirects.map((redirect) => (
                <TableRow key={redirect.source}>
                  <TableCell>
                    <ValueLinkChip value={redirect.source} />
                  </TableCell>
                  <TableCell>
                    <ArrowRight className='text-muted-foreground h-4 w-4 rtl:rotate-180' />
                  </TableCell>
                  <TableCell>
                    <ValueLinkChip value={redirect.target} />
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatTimestamp(redirect.created)}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground'
                              disabled={isDeleting}
                              aria-label={t`Delete redirect ${redirect.source}`}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{t`Delete redirect ${redirect.source}`}</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            <Trans>Delete redirect?</Trans>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <Trans>
                              This will remove the redirect from "
                              {redirect.source}" to "{redirect.target}".
                            </Trans>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            <Trans>Cancel</Trans>
                          </AlertDialogCancel>
                          <AlertDialogAction
                            loading={isDeleting}
                            onClick={() => void handleDelete(redirect.source)}
                            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                          >
                            <Trans>Delete</Trans>
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
  onSuccess: () => void
}

function AddRedirectDialog({ onSuccess }: AddRedirectDialogProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const apiUrl = useEntityEndpoint()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!source.trim() || !target.trim()) {
      toast.error(t`Both source and target are required`)
      return
    }

    setIsCreating(true)
    try {
      await toastAction(
        requestHelpers.post(apiUrl(endpoints.wiki.redirectSet), {
          source: source.trim(),
          target: target.trim(),
        }),
        {
          loading: t`Creating redirect...`,
          success: t`Redirect created`,
          error: (err) => getErrorMessage(err, t`Failed to create redirect`),
        }
      )
      setSource('')
      setTarget('')
      setOpen(false)
      onSuccess()
    } catch {
      // toast already shown
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className='me-2 h-4 w-4' />
          <Trans>Add redirect</Trans>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>
              <Trans>Create redirect</Trans>
            </DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='source'>
                <Trans>Source URL</Trans>
              </Label>
              <Input
                id='source'
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t`old-page-name`}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='target'>
                <Trans>Target URL</Trans>
              </Label>
              <Input
                id='target'
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={t`new-page-name`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              type='submit'
              loading={isCreating}
              icon={<Plus className='me-2 h-4 w-4' />}
            >
              <Trans>Create redirect</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
