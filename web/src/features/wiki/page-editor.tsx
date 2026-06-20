// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useRef } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useNavigate } from '@tanstack/react-router'
import { Save, X, Eye, Pencil, Trash2, ImagePlus, Image, Loader2, Plus, RefreshCw } from 'lucide-react'
import {
  toast,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  EmptyState,
  GeneralError,
  Input,
  Textarea,
  Label,
  ListSkeleton,
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
  authenticatedUrl,
  extractStatus,
} from '@mochi/web'
import {
  useEditPage,
  useCreatePage,
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/use-wiki'
import { usePermissions } from '@/context/wiki-context'
import { useWikiBaseURLOptional } from '@/context/wiki-base-url-context'
import type { WikiPage, Attachment } from '@/types/wiki'
import { ATTACHMENT_ACCEPT, isSupportedAttachmentFile } from './attachment-upload'
import { MarkdownContent } from './markdown-content'

interface PageEditorProps {
  page?: WikiPage
  slug: string
  isNew?: boolean
  wikiId?: string
}

function buildAttachmentUrl(baseURL: string, id: string): string {
  return authenticatedUrl(`${baseURL}attachments/${id}`)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function PageEditor({ page, slug, isNew = false, wikiId: wikiIdProp }: PageEditorProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const editPage = useEditPage()
  const createPage = useCreatePage()
  const permissions = usePermissions()
  const wikiContext = useWikiBaseURLOptional()

  // Determine wikiId from multiple sources for robust routing:
  // 1. Explicit prop (from route params)
  // 2. Context (WikiBaseURLContext)
  // 3. URL path (class context like /wikis/$wikiId/...)
  let wikiId = wikiIdProp ?? wikiContext?.wiki?.fingerprint ?? wikiContext?.wiki?.id

  // If still no wikiId, try to extract from URL for class context
  if (!wikiId) {
    const pathname = window.location.pathname
    const classContextMatch = pathname.match(/^\/wikis\/([^/]+)\//)
    if (classContextMatch) {
      wikiId = classContextMatch[1]
    }
  }

  const [title, setTitle] = useState(page?.title ?? '')
  const [content, setContent] = useState(page?.content ?? '')
  const [comment, setComment] = useState('')
  const [newSlug, setNewSlug] = useState(slug)
  const [slugEdited, setSlugEdited] = useState(!!slug) // pre-filled slugs are treated as edited
  const [showPreview, setShowPreview] = useState(false)
  const [insertDialogOpen, setInsertDialogOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorPositionRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    data: attachmentsData,
    isLoading: isAttachmentsLoading,
    error: attachmentsError,
    refetch: refetchAttachments,
  } = useAttachments()
  const uploadMutation = useUploadAttachment()
  const deleteMutation = useDeleteAttachment()
  const attachments = attachmentsData?.attachments || []
  const attachmentPageSlug = (isNew ? newSlug : slug).trim()

  const isPending = editPage.isPending || createPage.isPending

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (!slugEdited) {
      setNewSlug(slugify(newTitle))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSlug(e.target.value)
    setSlugEdited(true)
  }

  const handleResetSlug = () => {
    setNewSlug(slugify(title))
    setSlugEdited(false)
  }

  // Save cursor position when opening dialog
  const handleOpenInsertDialog = () => {
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart
    }
    setUploadError(null)
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

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPos = pos + markdown.length
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  // Handle file upload from dialog
  const getAttachmentValidationError = (files: File[]) => {
    const unsupported = files.filter((file) => !isSupportedAttachmentFile(file))
    if (unsupported.length === 0) {
      return null
    }

    const names = unsupported.slice(0, 3).map((file) => file.name).join(', ')
    return unsupported.length === 1
      ? t`Unsupported file type: ${names}. Supported files: images, PDF, DOC, DOCX, TXT, and MD.`
      : t`Unsupported file types: ${names}. Supported files: images, PDF, DOC, DOCX, TXT, and MD.`
  }

  const getUploadErrorMessage = (error: unknown) => {
    const status = extractStatus(error)
    if (status === 413) {
      return t`This file is too large for the current server upload limit. Try a smaller file or increase the server or proxy upload size limit.`
    }

    const message = getErrorMessage(error, t`Failed to upload files`)
    if (message === 'Network Error') {
      return t`Upload failed. The file may be too large for the current server or proxy upload limit. If the file is small, check your connection and try again.`
    }
    if (message.toLowerCase().includes('storage limit exceeded')) {
      return t`Upload failed because this account has reached its storage limit.`
    }
    if (message.toLowerCase().includes('file too large')) {
      return t`This file is too large to upload. Try a smaller file.`
    }

    return message
  }

  const handleUpload = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) {
      return
    }

    const validationError = getAttachmentValidationError(fileArray)
    if (validationError) {
      setUploadError(validationError)
      return
    }

    setUploadError(null)
    const fileCount = fileArray.length
    uploadMutation.mutate(fileArray, {
      onSuccess: () => {
        setUploadError(null)
        toast.success(plural(fileCount, { one: '# file uploaded', other: '# files uploaded' }))
      },
      onError: (error) => {
        setUploadError(getUploadErrorMessage(error))
      },
    })
  }

  const handleDeleteAttachment = (attachment: Attachment) => {
    setPendingDelete(attachment)
  }

  const confirmDeleteAttachment = () => {
    if (!pendingDelete) return

    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(t`Attachment deleted`)
        setPendingDelete(null)
      },
      onError: (error) => {
        setUploadError(getErrorMessage(error, t`Failed to delete attachment`))
        setPendingDelete(null)
      },
    })
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(t`Title is required`)
      return
    }

    if (isNew) {
      if (!newSlug.trim()) {
        toast.error(t`Page URL is required`)
        return
      }

      createPage.mutate(
        { slug: newSlug.trim(), title: title.trim(), content },
        {
          onSuccess: (data) => {
            toast.success(t`Page created`)
            if (wikiId) {
              navigate({ to: '/$wikiId/$page', params: { wikiId, page: data.slug } })
            } else {
              navigate({ to: '/$page', params: { page: data.slug } })
            }
          },
          onError: (error) => {
            toast.error(getErrorMessage(error, t`Failed to create page`))
          },
        }
      )
    } else {
      editPage.mutate(
        { slug, title: title.trim(), content, comment: comment.trim() },
        {
          onSuccess: () => {
            toast.success(t`Page saved`)
            if (wikiId) {
              navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
            } else {
              navigate({ to: '/$page', params: { page: slug } })
            }
          },
          onError: (error) => {
            toast.error(getErrorMessage(error, t`Failed to save page`))
          },
        }
      )
    }
  }

  const handleCancel = () => {
    if (isNew) {
      if (wikiId) {
        const homeSlug = wikiContext?.wiki?.home ?? 'home'
        navigate({ to: '/$wikiId/$page', params: { wikiId, page: homeSlug } })
      } else {
        navigate({ to: '/' })
      }
    } else if (wikiId) {
      navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
    } else {
      navigate({ to: '/$page', params: { page: slug } })
    }
  }

  return (
    <div className="space-y-6">
      {/* Action toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? (
            <>
              <Pencil className="me-2 h-4 w-4" />
              <Trans>Edit</Trans>
            </>
          ) : (
            <>
              <Eye className="me-2 h-4 w-4" />
              <Trans>Preview</Trans>
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenInsertDialog}
        >
          <ImagePlus className="me-2 h-4 w-4" />
          <Trans>Insert</Trans>
        </Button>
        {attachmentPageSlug ? (
          <Button variant="outline" size="sm" asChild>
            {wikiId ? (
              <Link to="/$wikiId/$page/attachments" params={{ wikiId, page: attachmentPageSlug }}>
                <Image className="me-2 h-4 w-4" />
                <Trans>Attachments</Trans>
              </Link>
            ) : (
              <Link to="/$page/attachments" params={{ page: attachmentPageSlug }}>
                <Image className="me-2 h-4 w-4" />
                <Trans>Attachments</Trans>
              </Link>
            )}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <Image className="me-2 h-4 w-4" />
            <Trans>Attachments</Trans>
          </Button>
        )}
        <div className="ms-auto flex items-center gap-2">
          {!isNew && permissions.delete && (
            <Button variant="outline" size="sm" asChild>
              {wikiId ? (
                <Link to="/$wikiId/$page/delete" params={{ wikiId, page: slug }}>
                  <Trash2 className="me-2 h-4 w-4" />
                  <Trans>Delete page</Trans>
                </Link>
              ) : (
                <Link to="/$page/delete" params={{ page: slug }}>
                  <Trash2 className="me-2 h-4 w-4" />
                  <Trans>Delete page</Trans>
                </Link>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="me-2 h-4 w-4" />
            <Trans>Cancel</Trans>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isNew ? (
              <>
                {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                {isPending ? t`Creating...` : t`Create page`}
              </>
            ) : (
              <>
                {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                {isPending ? t`Saving...` : t`Save`}
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {showPreview ? (
        /* Preview mode */
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{title || t`Untitled`}</h2>
          <MarkdownContent content={content || t`*No content*`} />
        </div>
      ) : (
        /* Edit mode */
        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title"><Trans>Title</Trans></Label>
            <Input
              id="title"
              value={title}
              onChange={handleTitleChange}
              placeholder={t`Page title`}
            />
          </div>

          {/* Slug (only for new pages, shown below title) */}
          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="slug"><Trans>Page URL</Trans></Label>
              <div className="flex items-center gap-2">
                <Input
                  id="slug"
                  value={newSlug}
                  onChange={handleSlugChange}
                  placeholder={t`my-page-name`}
                  className="flex-1"
                />
                {slugEdited && title && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetSlug}
                    title={t`Re-derive from title`}
                    className="shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                <Trans>
                  This will be the path for the page. Use lower case letters,
                  numbers, and hyphens.
                </Trans>
              </p>
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content"><Trans>Content</Trans></Label>
            <Textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t`Write your content here using Markdown...`}
              className="min-h-[400px] font-mono"
            />
          </div>

          {/* Comment (only for edits) */}
          {!isNew && (
            <div className="space-y-2">
              <Label htmlFor="comment"><Trans>Edit summary (optional)</Trans></Label>
              <Input
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t`Briefly describe your changes`}
              />
            </div>
          )}
        </div>
      )}

      {/* Insert attachment dialog */}
      <Dialog open={insertDialogOpen} onOpenChange={setInsertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle><Trans>Insert attachment</Trans></DialogTitle>
            <DialogDescription>
              <Trans>Select an attachment to insert into your page, or upload a new file.</Trans>
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertTitle><Trans>Supported files</Trans></AlertTitle>
            <AlertDescription>
              <p><Trans>images, PDF, DOC, DOCX, TXT, and MD. Large uploads may also be limited by your server or proxy configuration.</Trans></p>
            </AlertDescription>
          </Alert>

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
              accept={ATTACHMENT_ACCEPT}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="me-2 h-4 w-4" />
              )}
              <Trans>Upload new</Trans>
            </Button>
          </div>

          {uploadError ? (
            <Alert variant="destructive">
              <AlertTitle><Trans>Upload failed</Trans></AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Attachments grid */}
          {isAttachmentsLoading ? (
            <ListSkeleton variant="simple" height="h-16" count={4} />
          ) : attachmentsError ? (
            <GeneralError
              error={attachmentsError}
              minimal
              mode="inline"
              reset={refetchAttachments}
              className="py-8"
            />
          ) : attachments.length === 0 ? (
            <EmptyState
              icon={Image}
              title={t`No attachments yet`}
              description={t`Upload a file to get started.`}
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {attachments.map((attachment) => {
                const FileIcon = getFileIcon(attachment.type)
                const isDeleting =
                  deleteMutation.isPending &&
                  deleteMutation.variables === attachment.id
                return (
                  <div
                    key={attachment.id}
                    className="group relative rounded-lg border p-2 text-start transition-colors hover:bg-hover"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-3 z-10 h-7 w-7 bg-background/90 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteAttachment(attachment)
                      }}
                      disabled={isDeleting}
                      aria-label={t`Delete attachment`}
                      title={t`Delete attachment`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown(attachment)}
                      className="block w-full rounded focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <div className="bg-muted mb-2 flex aspect-square items-center justify-center overflow-hidden rounded">
                        {isImage(attachment.type) ? (
                          <img
                            src={`${buildAttachmentUrl(wikiContext?.baseURL ?? '', attachment.id)}/thumbnail`}
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
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t`Delete attachment`}
        desc={
          pendingDelete
            ? t`Delete "${pendingDelete.name}"? This cannot be undone.`
            : ''
        }
        confirmText={t`Delete`}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={confirmDeleteAttachment}
      />
    </div>
  )
}

export function PageEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
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
