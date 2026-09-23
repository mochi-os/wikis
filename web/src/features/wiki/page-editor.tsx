// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState, useRef, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import type { WikiPage, Attachment } from '@/types/wiki'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  isImage,
  getFileIcon,
  getErrorMessage,
  authenticatedUrl,
  getAppPath,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  textChanged,
  isMutationSkipped,
  UploadProgress,
} from '@mochi/web'
import {
  Check,
  X,
  Eye,
  Pencil,
  Trash2,
  ImagePlus,
  Image,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useWikiBaseURLOptional } from '@/context/wiki-base-url-context'
import {
  useEditPage,
  useCreatePage,
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/use-wiki'
import {
  ATTACHMENT_ACCEPT,
  useAttachmentUploadMessages,
} from './attachment-upload'
import { MarkdownContent } from './markdown-content'

interface PageEditorProps {
  page?: WikiPage
  slug: string
  isNew?: boolean
  wikiId?: string
}

function buildAttachmentUrl(baseURL: string, id: string): string {
  return authenticatedUrl(`${baseURL}attachments/${encodeURIComponent(id)}`)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function PageEditor({
  page,
  slug,
  isNew = false,
  wikiId: wikiIdProp,
}: PageEditorProps) {
  const { t } = useLingui()
  const { validate, describe } = useAttachmentUploadMessages()
  const navigate = useNavigate()
  const editPage = useEditPage()
  const createPage = useCreatePage()
  const wikiContext = useWikiBaseURLOptional()

  // Determine wikiId from multiple sources for robust routing:
  // 1. Explicit prop (from route params)
  // 2. Context (WikiBaseURLContext)
  // 3. URL path (class context like /wikis/$wikiId/...)
  let wikiId =
    wikiIdProp ?? wikiContext?.wiki?.fingerprint ?? wikiContext?.wiki?.id

  // Fall back to the URL under the app's actual prefix - "/wikis/" is app.json
  // configuration, not a constant. Under domain-entity routing getAppPath() is
  // "" and the first segment is a page slug, so there is nothing to match and
  // the entity-relative branch is taken.
  if (!wikiId) {
    const appPath = getAppPath()
    if (appPath) {
      const prefix = `${appPath}/`
      const pathname = window.location.pathname
      if (pathname.startsWith(prefix)) {
        wikiId = pathname.slice(prefix.length).split('/')[0] || undefined
      }
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

  const pageDirty = useMemo(() => {
    if (isNew) return true
    if (!page) return true
    return textChanged(title, page.title) || content !== page.content
  }, [isNew, page, title, content])

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
    const url = `attachments/${encodeURIComponent(attachment.id)}`
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

  const handleUpload = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) {
      return
    }

    const refusal = validate(fileArray)
    if (refusal) {
      setUploadError(refusal)
      return
    }

    setUploadError(null)
    const fileCount = fileArray.length
    uploadMutation.mutate(fileArray, {
      onSuccess: () => {
        setUploadError(null)
        toast.success(
          plural(fileCount, {
            one: '# file uploaded',
            other: '# files uploaded',
          })
        )
      },
      onError: (error) => {
        setUploadError(describe(error))
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
              navigate({
                to: '/$wikiId/$page',
                params: { wikiId, page: data.slug },
              })
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
      if (!pageDirty) {
        return
      }
      const original = {
        title: page?.title ?? '',
        content: page?.content ?? '',
      }
      editPage.mutate(
        {
          slug,
          title: title.trim(),
          content,
          comment: comment.trim(),
          original,
        },
        {
          onSuccess: (result) => {
            if (isMutationSkipped(result)) return
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
    <div className='space-y-6'>
      {/* Editing tools */}
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? (
            <>
              <Pencil className='me-2 h-4 w-4' />
              <Trans>Edit</Trans>
            </>
          ) : (
            <>
              <Eye className='me-2 h-4 w-4' />
              <Trans>Preview</Trans>
            </>
          )}
        </Button>
        <Button variant='outline' size='sm' onClick={handleOpenInsertDialog}>
          <ImagePlus className='me-2 h-4 w-4' />
          <Trans>Insert</Trans>
        </Button>
        {attachmentPageSlug ? (
          <Button variant='outline' size='sm' asChild>
            {wikiId ? (
              <Link
                preload={false}
                to='/$wikiId/$page/attachments'
                params={{ wikiId, page: attachmentPageSlug }}
              >
                <Image className='me-2 h-4 w-4' />
                <Trans>Attachments</Trans>
              </Link>
            ) : (
              <Link
                preload={false}
                to='/$page/attachments'
                params={{ page: attachmentPageSlug }}
              >
                <Image className='me-2 h-4 w-4' />
                <Trans>Attachments</Trans>
              </Link>
            )}
          </Button>
        ) : (
          <Button variant='outline' size='sm' disabled>
            <Image className='me-2 h-4 w-4' />
            <Trans>Attachments</Trans>
          </Button>
        )}
      </div>

      <Separator />

      {showPreview ? (
        /* Preview mode */
        <div className='space-y-4'>
          <h2 className='text-xl font-semibold'>{title || t`Untitled`}</h2>
          <MarkdownContent content={content || t`*No content*`} />
        </div>
      ) : (
        /* Edit mode */
        <div className='space-y-4'>
          {/* Title */}
          <div className='space-y-2'>
            <Label htmlFor='title'>
              <Trans>Title</Trans>
            </Label>
            <Input
              id='title'
              value={title}
              onChange={handleTitleChange}
              placeholder={t`Page title`}
            />
          </div>

          {/* Slug (only for new pages, shown below title) */}
          {isNew && (
            <div className='space-y-2'>
              <Label htmlFor='slug'>
                <Trans>Page URL</Trans>
              </Label>
              <div className='flex items-center gap-2'>
                <Input
                  id='slug'
                  value={newSlug}
                  onChange={handleSlugChange}
                  placeholder={t`my-page-name`}
                  className='flex-1'
                />
                {slugEdited && title && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleResetSlug}
                        aria-label={t`Re-derive from title`}
                        className='shrink-0'
                      >
                        <RefreshCw className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t`Re-derive from title`}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className='space-y-2'>
            <Label htmlFor='content'>
              <Trans>Content</Trans>
            </Label>
            <Textarea
              ref={textareaRef}
              id='content'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t`Write your content here using Markdown...`}
              className='min-h-[400px] font-mono'
            />
          </div>
        </div>
      )}

      {/* Save bar: pinned so Save stays in reach on a long page, and outside
          the edit/preview switch so the summary shows in both */}
      <div className='bg-background sticky bottom-0 flex flex-col gap-2 border-t py-4 sm:flex-row sm:items-center'>
        {!isNew && (
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t`Edit summary (optional)`}
            aria-label={t`Edit summary (optional)`}
            className='sm:flex-1'
          />
        )}
        <div className='flex items-center justify-end gap-2 sm:ms-auto'>
          <Button variant='outline' onClick={handleCancel}>
            <X className='me-2 h-4 w-4' />
            <Trans>Cancel</Trans>
          </Button>
          <Button
            onClick={handleSave}
            loading={isPending}
            disabled={!isNew && !pageDirty}
            icon={
              isNew ? (
                <Plus className='me-2 h-4 w-4' />
              ) : (
                <Check className='me-2 h-4 w-4' />
              )
            }
          >
            {isNew ? t`Create page` : t`Save`}
          </Button>
        </div>
      </div>

      {/* Insert attachment dialog */}
      <ResponsiveDialog
        open={insertDialogOpen}
        onOpenChange={setInsertDialogOpen}
      >
        <ResponsiveDialogContent className='sm:max-w-2xl'>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              <Trans>Insert attachment</Trans>
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          {/* Upload button */}
          <div className='flex items-center gap-2'>
            <input
              ref={fileInputRef}
              type='file'
              multiple
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files)
                e.target.value = ''
              }}
              className='hidden'
              accept={ATTACHMENT_ACCEPT}
            />
            <Button
              variant='outline'
              size='sm'
              onClick={() => fileInputRef.current?.click()}
              loading={uploadMutation.isPending}
              icon={<ImagePlus className='me-2 h-4 w-4' />}
            >
              <Trans>Upload new</Trans>
            </Button>
          </div>

          <UploadProgress progress={uploadMutation.progress} />

          {uploadError ? (
            <Alert variant='destructive'>
              <AlertTitle>
                <Trans>Upload failed</Trans>
              </AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Attachments grid */}
          {isAttachmentsLoading ? (
            <ListSkeleton variant='simple' height='h-16' count={4} />
          ) : attachmentsError ? (
            <GeneralError
              error={attachmentsError}
              minimal
              mode='inline'
              reset={refetchAttachments}
              className='py-8'
            />
          ) : attachments.length === 0 ? (
            <EmptyState
              icon={Image}
              title={t`No attachments yet`}
              description={t`Upload a file to get started.`}
              className='py-8'
            />
          ) : (
            <div className='grid max-h-[400px] grid-cols-3 gap-3 overflow-y-auto'>
              {attachments.map((attachment) => {
                const FileIcon = getFileIcon(attachment.type)
                const isDeleting =
                  deleteMutation.isPending &&
                  deleteMutation.variables === attachment.id
                return (
                  <div
                    key={attachment.id}
                    className='group hover:bg-hover relative rounded-lg border p-2 text-start transition-colors'
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='bg-background/90 absolute top-3 right-3 z-10 h-7 w-7 shadow-sm'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAttachment(attachment)
                          }}
                          loading={isDeleting}
                          icon={<Trash2 className='h-3.5 w-3.5' />}
                          aria-label={t`Delete attachment`}
                        ></Button>
                      </TooltipTrigger>
                      <TooltipContent>{t`Delete attachment`}</TooltipContent>
                    </Tooltip>
                    <button
                      type='button'
                      onClick={() => insertMarkdown(attachment)}
                      className='focus:ring-ring block w-full rounded focus:ring-2 focus:outline-none'
                    >
                      <div className='bg-muted mb-2 flex aspect-square items-center justify-center overflow-hidden rounded'>
                        {isImage(attachment.type) ? (
                          <img
                            src={`${buildAttachmentUrl(wikiContext?.baseURL ?? '', attachment.id)}/thumbnail`}
                            alt={attachment.name}
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <FileIcon className='text-muted-foreground h-8 w-8' />
                        )}
                      </div>
                      <p className='truncate text-xs' title={attachment.name}>
                        {attachment.name}
                      </p>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

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
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <Skeleton className='h-9 w-24' />
        <Skeleton className='h-9 w-24' />
        <Skeleton className='h-9 w-24' />
        <Skeleton className='h-9 w-20' />
      </div>
      <Separator />
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Skeleton className='h-5 w-12' />
          <Skeleton className='h-10 w-full' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-5 w-16' />
          <Skeleton className='h-[400px] w-full' />
        </div>
      </div>
    </div>
  )
}
