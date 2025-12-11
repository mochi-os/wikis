import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Settings, Save, Trash2 } from 'lucide-react'
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
import { useWikiSettings, useSetWikiSetting, useDeleteWiki } from '@/hooks/use-wiki'

export function WikiSettings() {
  const { data, isLoading, error } = useWikiSettings()
  const setSetting = useSetWikiSetting()
  const deleteWiki = useDeleteWiki()

  const [homePage, setHomePage] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize from loaded settings
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
    return <WikiSettingsSkeleton />
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Wiki Settings</h1>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || setSetting.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {setSetting.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Separator />

      {/* Settings cards */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Home Page</CardTitle>
            <CardDescription>
              The page that users see when they first visit the wiki. This should
              be the slug of an existing page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="home-page">Home page slug</Label>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete Wiki</CardTitle>
            <CardDescription>
              Permanently delete this wiki and all its pages, revisions, tags, and attachments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleteWiki.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleteWiki.isPending ? 'Deleting...' : 'Delete Wiki'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the wiki
                      and all its contents including pages, revisions, tags, redirects,
                      and attachments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Wiki
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function WikiSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
