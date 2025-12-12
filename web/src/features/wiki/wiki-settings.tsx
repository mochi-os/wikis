import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Settings,
  Save,
  Trash2,
  Plus,
  X,
  Shield,
  ShieldCheck,
  ShieldX,
  Link2,
  ArrowRight,
  Home,
} from 'lucide-react'
import { getAppPath } from '@/lib/app-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useWikiSettings,
  useSetWikiSetting,
  useDeleteWiki,
  useAccessRules,
  useGrantAccess,
  useDenyAccess,
  useRevokeAccess,
  useRedirects,
  useSetRedirect,
  useDeleteRedirect,
} from '@/hooks/use-wiki'
import type { AccessRule } from '@/types/wiki'

type TabId = 'general' | 'access' | 'redirects' | 'delete'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: <Home className="h-4 w-4" /> },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" /> },
  { id: 'redirects', label: 'Redirects', icon: <Link2 className="h-4 w-4" /> },
  { id: 'delete', label: 'Delete', icon: <Trash2 className="h-4 w-4" /> },
]

export function WikiSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('general')

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
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'access' && <AccessTab />}
        {activeTab === 'redirects' && <RedirectsTab />}
        {activeTab === 'delete' && <DeleteTab />}
      </div>
    </div>
  )
}

function GeneralTab() {
  const { data, isLoading, error } = useWikiSettings()
  const setSetting = useSetWikiSetting()

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
  )
}

// Subject type labels for display
const SUBJECT_LABELS: Record<string, string> = {
  '*': 'Anyone, including anonymous',
  '+': 'Authenticated users',
  '#user': 'All users with a role',
  '#administrator': 'Administrators',
}

// Operation labels
const OPERATION_LABELS: Record<string, string> = {
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  manage: 'Manage',
  '*': 'All operations',
}

function formatSubject(subject: string): string {
  if (SUBJECT_LABELS[subject]) {
    return SUBJECT_LABELS[subject]
  }
  if (subject.startsWith('@')) {
    return `Group: ${subject.slice(1)}`
  }
  if (subject.length > 20) {
    return `${subject.slice(0, 8)}...${subject.slice(-8)}`
  }
  return subject
}

function AccessTab() {
  const { data, isLoading, error } = useAccessRules()
  const grantAccess = useGrantAccess()
  const denyAccess = useDenyAccess()
  const revokeAccess = useRevokeAccess()

  const [newSubject, setNewSubject] = useState('')
  const [newOperation, setNewOperation] = useState('view')
  const [newType, setNewType] = useState<'allow' | 'deny'>('allow')

  const handleAdd = () => {
    if (!newSubject.trim()) {
      toast.error('Subject is required')
      return
    }

    const mutation = newType === 'allow' ? grantAccess : denyAccess
    mutation.mutate(
      { subject: newSubject.trim(), operation: newOperation },
      {
        onSuccess: () => {
          toast.success('Access rule added')
          setNewSubject('')
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to add access rule')
        },
      }
    )
  }

  const handleRevoke = (rule: AccessRule) => {
    revokeAccess.mutate(
      { subject: rule.subject, operation: rule.operation },
      {
        onSuccess: () => {
          toast.success('Access rule removed')
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to remove access rule')
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Control</CardTitle>
        <CardDescription>
          Control who can view, edit, delete, and manage this wiki. Enter a user
          identity, <code className="text-xs">@group</code> for the name of a group,{' '}
          <code className="text-xs">+</code> for all authenticated users, or{' '}
          <code className="text-xs">*</code> for anyone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new rule */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="User id, @group, +, or *"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="operation">Operation</Label>
            <Select value={newOperation} onValueChange={setNewOperation}>
              <SelectTrigger id="operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="manage">Manage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select value={newType} onValueChange={(v) => setNewType(v as 'allow' | 'deny')}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAdd}
            disabled={grantAccess.isPending || denyAccess.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        <Separator />

        {/* Rules table */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">
            Error loading access rules: {error.message}
          </div>
        ) : data?.rules && data.rules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.rules]
                .sort((a, b) => {
                  // Sort order: user IDs, @groups, +, *
                  const priority = (s: string) => {
                    if (s === '*') return 3
                    if (s === '+') return 2
                    if (s.startsWith('@') || s.startsWith('#')) return 1
                    return 0
                  }
                  return priority(a.subject) - priority(b.subject)
                })
                .map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-sm">
                    {formatSubject(rule.subject)}
                  </TableCell>
                  <TableCell>{OPERATION_LABELS[rule.operation] || rule.operation}</TableCell>
                  <TableCell>
                    {rule.grant === 1 ? (
                      <Badge variant="default" className="bg-green-600">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Allow
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <ShieldX className="h-3 w-3 mr-1" />
                        Deny
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(rule)}
                      disabled={revokeAccess.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            No access rules configured. Add rules to control who can access this wiki.
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
                    {format(new Date(redirect.created * 1000), 'PPP')}
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

function DeleteTab() {
  const deleteWiki = useDeleteWiki()

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete wiki</CardTitle>
        <CardDescription>
          Permanently delete this wiki and all its pages, revisions, tags, redirects,
          and attachments. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
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
