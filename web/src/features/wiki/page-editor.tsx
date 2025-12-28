import { useState, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Save, X, Eye, Edit2, Trash2, ImagePlus, Image, Loader2 } from 'lucide-react'
import {
  Button,
  getApiBasepath,
  Input,
  Textarea,
  Label,
  Separator,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  isImage,
  getFileIcon,
  getErrorMessage,
} from '@mochi/common'
import { useEditPage, useCreatePage, useAttachments, useUploadAttachment } from '@/hooks/use-wiki'
import { usePermissions } from '@/context/wiki-context'
import type { WikiPage, Attachment } from '@/types/wiki'
import { MarkdownContent } from './markdown-content'

interface PageEditorProps {
  page?: WikiPage
  slug: string
  isNew?: boolean
}

// Build attachment URL using API basepath
function getAttachmentUrl(id: string): string {
  return `${getApiBasepath()}attachments/${id}`
}

export function PageEditor({ page, slug, isNew = false }: PageEditorProps) {
  const navigate = useNavigate()
  const editPage = useEditPage()
  const createPage = useCreatePage()
  const permissions = usePermissions()

  const [title, setTitle] = useState(page?.title ?? '')
  const [content, setContent] = useState(page?.content ?? '')
  const [comment, setComment] = useState('')
  const [newSlug, setNewSlug] = useState(slug)
  const [showPreview, setShowPreview] = useState(false)
  const [insertDialogOpen, setInsertDialogOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorPositionRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: attachmentsData } = useAttachments()
  const uploadMutation = useUploadAttachment()
  const attachments = attachmentsData?.attachments || []

  const isPending = editPage.isPending || createPage.isPending

  // Save cursor position when opening dialog
  const handleOpenInsertDialog = () => {
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart
    }
    setInsertDialogOpen(true)
  }

  // Insert markdown at saved cursor position
  const insertMarkdown = (attachment: Attachment) => {
    const url = `attachments/${attachment.id}`
    const markdown = isImage(attachment.type)
      ? `![${attachment.name}](${url}/thumbnail)`
      : `[${attachment.name}](${url})`

    const pos = cursorPositionRef.current
    const newContent = content.slice(0, pos) + markdown + content.slice(pos)
    setContent(newContent)
    setInsertDialogOpen(false)

    // Focus textarea and set cursor after inserted text
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPos = pos + markdown.length
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  // Handle file upload from dialog
  const handleUpload = (files: FileList) => {
    if (files.length > 0) {
      uploadMutation.mutate(Array.from(files), {
        onSuccess: () => {
          toast.success(`${files.length} file(s) uploaded`)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to upload files'))
        },
      })
    }
  }

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
            toast.error(getErrorMessage(error, 'Failed to create page'))
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
            toast.error(getErrorMessage(error, 'Failed to save page'))
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInsertDialog}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Insert
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/$page/attachments" params={{ page: slug }}>
              <Image className="mr-2 h-4 w-4" />
              Attachments
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          {!isNew && permissions.delete && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/$page/delete" params={{ page: slug }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete page
              </Link>
            </Button>
          )}
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
                This will be the path for the page. Use lower case letters,
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
            <Label htmlFor="content">Content</Label>
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

      {/* Insert attachment dialog */}
      <Dialog open={insertDialogOpen} onOpenChange={setInsertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Insert attachment</DialogTitle>
            <DialogDescription>
              Select an attachment to insert into your page, or upload a new file.
            </DialogDescription>
          </DialogHeader>

          {/* Upload button */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files)
                e.target.value = ''
              }}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              Upload new
            </Button>
          </div>

          {/* Attachments grid */}
          {attachments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No attachments yet. Upload a file to get started.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
              {attachments.map((attachment) => {
                const FileIcon = getFileIcon(attachment.type)
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => insertMarkdown(attachment)}
                    className="group rounded-lg border p-2 text-left hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded mb-2">
                      {isImage(attachment.type) ? (
                        <img
                          src={`${getAttachmentUrl(attachment.id)}/thumbnail`}
                          alt={attachment.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs truncate" title={attachment.name}>
                      {attachment.name}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
