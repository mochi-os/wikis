import { useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Save, X, Eye, Edit2, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useEditPage, useCreatePage } from '@/hooks/use-wiki'
import type { WikiPage } from '@/types/wiki'
import { MarkdownContent } from './markdown-content'
import { AttachmentPicker } from './attachment-picker'

interface PageEditorProps {
  page?: WikiPage
  slug: string
  isNew?: boolean
}

export function PageEditor({ page, slug, isNew = false }: PageEditorProps) {
  const navigate = useNavigate()
  const editPage = useEditPage()
  const createPage = useCreatePage()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState(page?.title ?? '')
  const [content, setContent] = useState(page?.content ?? '')
  const [comment, setComment] = useState('')
  const [newSlug, setNewSlug] = useState(slug)
  const [showPreview, setShowPreview] = useState(false)

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setContent((prev) => prev + text)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.slice(0, start) + text + content.slice(end)
    setContent(newContent)

    // Set cursor position after inserted text
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const isPending = editPage.isPending || createPage.isPending

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (isNew) {
      if (!newSlug.trim()) {
        toast.error('Page URL is required')
        return
      }

      createPage.mutate(
        { slug: newSlug.trim(), title: title.trim(), content },
        {
          onSuccess: (data) => {
            toast.success('Page created')
            navigate({ to: '/$page', params: { page: data.slug } })
          },
          onError: (error) => {
            toast.error(error.message || 'Failed to create page')
          },
        }
      )
    } else {
      editPage.mutate(
        { slug, title: title.trim(), content, comment: comment.trim() },
        {
          onSuccess: () => {
            toast.success('Page saved')
            navigate({ to: '/$page', params: { page: slug } })
          },
          onError: (error) => {
            toast.error(error.message || 'Failed to save page')
          },
        }
      )
    }
  }

  const handleCancel = () => {
    if (isNew) {
      navigate({ to: '/' })
    } else {
      navigate({ to: '/$page', params: { page: slug } })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {isNew ? 'Create new page' : `Editing: ${page?.title ?? slug}`}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </>
            )}
          </Button>
          <AttachmentPicker
            onSelect={(_, markdown) => insertAtCursor(markdown)}
            trigger={
              <Button variant="outline" size="sm">
                <Image className="mr-2 h-4 w-4" />
                Attachments
              </Button>
            }
          />
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Separator />

      {showPreview ? (
        /* Preview mode */
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{title || 'Untitled'}</h2>
          <MarkdownContent content={content || '*No content*'} />
        </div>
      ) : (
        /* Edit mode */
        <div className="space-y-4">
          {/* Slug (only for new pages) */}
          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="slug">Page URL</Label>
              <Input
                id="slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="my-page-name"
              />
              <p className="text-muted-foreground text-sm">
                This will be the URL path for the page. Use lowercase letters,
                numbers, and hyphens.
              </p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content (Markdown)</Label>
            <Textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content here using Markdown..."
              className="min-h-[400px] font-mono"
            />
          </div>

          {/* Comment (only for edits) */}
          {!isNew && (
            <div className="space-y-2">
              <Label htmlFor="comment">Edit summary (optional)</Label>
              <Input
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Briefly describe your changes"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PageEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    </div>
  )
}
