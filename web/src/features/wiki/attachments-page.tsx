// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useRef, useMemo } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Upload,
  Trash2,
  Copy,
  Check,
  Loader2,
  Search,
  Grid3X3,
  List,
  ArrowUpDown,
  X,
  Image,
  ExternalLink,
} from 'lucide-react'
import {
  toast,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  EmptyState,
  GeneralError,
  ImageLightbox,
  type LightboxMedia,
  useLightboxHash,
  Input,
  Skeleton,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useFormat,
  getFileIcon,
  isImage,
  getErrorMessage,
  authenticatedUrl,
  shellClipboardWrite,
  naturalCompare,
  extractStatus,
} from '@mochi/web'
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/use-wiki'
import { useWikiBaseURL, useWikiBaseURLOptional } from '@/context/wiki-base-url-context'
import type { Attachment } from '@/types/wiki'
import { ATTACHMENT_ACCEPT, isSupportedAttachmentFile } from './attachment-upload'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AttachmentsPageProps {}

type ViewMode = 'grid' | 'list'
type FilterType = 'all' | 'images' | 'documents'
type SortBy = 'name' | 'date' | 'size'
const EMPTY_ATTACHMENTS: Attachment[] = []

function buildAttachmentUrl(baseURL: string, id: string): string {
  return authenticatedUrl(`${baseURL}attachments/${id}`)
}

export function AttachmentsPage(_props: AttachmentsPageProps) {
  const { t } = useLingui()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error, refetch } = useAttachments()
  const uploadMutation = useUploadAttachment()
  const deleteMutation = useDeleteAttachment()
  const wikiContext = useWikiBaseURLOptional()
  const baseURL = wikiContext?.baseURL ?? ''

  const attachments = data?.attachments ?? EMPTY_ATTACHMENTS

  // Filter and sort attachments
  const filteredAttachments = useMemo(() => {
    let result = [...attachments]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((a) => a.name.toLowerCase().includes(query))
    }

    // Apply type filter
    if (filterType === 'images') {
      result = result.filter((a) => isImage(a.type))
    } else if (filterType === 'documents') {
      result = result.filter((a) => !isImage(a.type))
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return naturalCompare(a.name, b.name)
        case 'date':
          return b.created - a.created
        case 'size':
          return b.size - a.size
        default:
          return 0
      }
    })

    return result
  }, [attachments, searchQuery, filterType, sortBy])

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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      handleUpload(files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleUpload(files)
    }
  }

  const handleCopy = (attachment: Attachment) => {
    const url = `attachments/${attachment.id}`
    const markdown = isImage(attachment.type)
      ? `![${attachment.name}](${url})`
      : `[${attachment.name}](${url})`

    void shellClipboardWrite(markdown).then((ok) => {
      if (ok) {
        setCopiedId(attachment.id)
        toast.success(t`Embed link copied`)
        setTimeout(() => setCopiedId(null), 2000)
      } else {
        toast.error(t`Failed to copy`)
      }
    })
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (attachment: Attachment) => {
    setPendingDelete(attachment)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const attachment = pendingDelete
    deleteMutation.mutate(attachment.id, {
      onSuccess: () => {
        toast.success(t`Attachment deleted`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t`Failed to delete attachment`))
        setPendingDelete(null)
      },
    })
  }

  const imageCount = attachments.filter((a) => isImage(a.type)).length
  const documentCount = attachments.length - imageCount

  // Build lightbox media from filtered image attachments
  const imageAttachments = filteredAttachments.filter((a) => isImage(a.type))
  const lightboxMedia: LightboxMedia[] = imageAttachments.map((a) => ({
    id: a.id,
    name: a.name,
    url: buildAttachmentUrl(baseURL, a.id),
    type: 'image' as const,
  }))

  const { open: lightboxOpen, currentIndex, openLightbox, closeLightbox, setCurrentIndex } =
    useLightboxHash(lightboxMedia)

  // Map image attachment ID to lightbox index for click handling
  const imageLightboxIndex = new Map(imageAttachments.map((a, i) => [a.id, i]))

  const handleOpen = (attachment: Attachment) => {
    const index = imageLightboxIndex.get(attachment.id)
    if (index !== undefined) {
      openLightbox(index)
    } else {
      // Non-image: open in new tab
      window.open(buildAttachmentUrl(baseURL, attachment.id), '_blank')
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload + stats */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          <Trans>
            {plural(attachments.length, { one: '# file', other: '# files' })} ({plural(imageCount, { one: '# image', other: '# images' })}, {plural(documentCount, { one: '# document', other: '# documents' })})
          </Trans>
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            accept={ATTACHMENT_ACCEPT}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="me-2 h-4 w-4" />
            )}
            <Trans>Upload files</Trans>
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTitle><Trans>Upload guidance</Trans></AlertTitle>
        <AlertDescription>
          <p><Trans>Supported files: images, PDF, DOC, DOCX, TXT, and MD.</Trans></p>
          <p><Trans>Large uploads may be limited by your server or proxy configuration.</Trans></p>
        </AlertDescription>
      </Alert>

      {uploadError ? (
        <Alert variant="destructive">
          <AlertTitle><Trans>Upload failed</Trans></AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t`Search attachments...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
              aria-label={t`Clear search`}
              title={t`Clear search`}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter */}
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t`Filter`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all"><Trans>All files</Trans></SelectItem>
            <SelectItem value="images"><Trans>Images</Trans></SelectItem>
            <SelectItem value="documents"><Trans>Documents</Trans></SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[130px]">
            <ArrowUpDown className="me-2 h-4 w-4" />
            <SelectValue placeholder={t`Sort`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date"><Trans>Date</Trans></SelectItem>
            <SelectItem value="name"><Trans>Name</Trans></SelectItem>
            <SelectItem value="size"><Trans>Size</Trans></SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="rounded-e-none"
            onClick={() => setViewMode('grid')}
            aria-label={t`Grid view`}
            title={t`Grid view`}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="rounded-s-none"
            onClick={() => setViewMode('list')}
            aria-label={t`List view`}
            title={t`List view`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Drop zone / Content */}
      <div
        className={`min-h-[400px] rounded-lg border-2 border-dashed transition-colors ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-transparent'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <AttachmentsPageSkeleton viewMode={viewMode} />
        ) : error ? (
          <div className="px-4 py-8">
            <GeneralError error={error} minimal mode="inline" reset={refetch} />
          </div>
        ) : filteredAttachments.length === 0 ? (
          <EmptyState
            icon={attachments.length === 0 ? Image : Search}
            title={
              attachments.length === 0
                ? t`No attachments yet` : t`No attachments match your search`
            }
            description={
              attachments.length === 0
                ? t`Drag and drop files here, or click "Upload files" to get started.`
                : t`Try a different search term or filter.`
            }
            className="h-[400px]"
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredAttachments.map((attachment) => (
              <AttachmentGridItem
                key={attachment.id}
                attachment={attachment}
                copiedId={copiedId}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === attachment.id}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onOpen={handleOpen}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAttachments.map((attachment) => (
              <AttachmentListItem
                key={attachment.id}
                attachment={attachment}
                copiedId={copiedId}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === attachment.id}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>

      <ImageLightbox
        images={lightboxMedia}
        currentIndex={currentIndex}
        open={lightboxOpen}
        onOpenChange={(isOpen) => !isOpen && closeLightbox()}
        onIndexChange={setCurrentIndex}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title={t`Delete attachment`}
        desc={pendingDelete ? t`Delete "${pendingDelete.name}"? This cannot be undone.` : ''}
        confirmText={t`Delete`}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={confirmDelete}
      />
    </div>
  )
}

interface AttachmentItemProps {
  attachment: Attachment
  copiedId: string | null
  isDeleting: boolean
  onCopy: (attachment: Attachment) => void
  onDelete: (attachment: Attachment) => void
  onOpen: (attachment: Attachment) => void
}

function AttachmentGridItem({
  attachment,
  copiedId,
  isDeleting,
  onCopy,
  onDelete,
  onOpen,
}: AttachmentItemProps) {
  const { t } = useLingui()
  const { formatFileSize } = useFormat()
  const FileIcon = getFileIcon(attachment.type)
  const { baseURL } = useWikiBaseURL()
  const attachmentUrl = buildAttachmentUrl(baseURL, attachment.id)

  return (
    <div className="group bg-card hover:bg-hover relative overflow-hidden rounded-lg border transition-colors">
      {/* Preview - clickable to open lightbox (images) or new tab (files) */}
      <button
        type="button"
        onClick={() => onOpen(attachment)}
        className="bg-muted flex aspect-square w-full items-center justify-center overflow-hidden"
      >
        {isImage(attachment.type) ? (
          <img
            src={`${attachmentUrl}/thumbnail`}
            alt={attachment.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileIcon className="text-muted-foreground h-12 w-12" />
        )}
      </button>

      {/* Info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatFileSize(attachment.size)}
        </p>
      </div>

      {/* Actions overlay - clicking background opens attachment, buttons stop propagation */}
      <div
        className="absolute inset-0 flex cursor-pointer items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onOpen(attachment)}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onCopy(attachment) }}
          aria-label={t`Copy embed link`}
          title={t`Copy embed link`}
        >
          {copiedId === attachment.id ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onDelete(attachment) }}
          disabled={isDeleting}
          aria-label={t`Delete attachment`}
          title={t`Delete`}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function AttachmentListItem({
  attachment,
  copiedId,
  isDeleting,
  onCopy,
  onDelete,
  onOpen,
}: AttachmentItemProps) {
  const { t } = useLingui()
  const { formatFileSize, formatTimestamp } = useFormat()
  const FileIcon = getFileIcon(attachment.type)
  const { baseURL } = useWikiBaseURL()
  const attachmentUrl = buildAttachmentUrl(baseURL, attachment.id)

  return (
    <div className="hover:bg-hover flex items-center gap-4 rounded-lg border p-3 transition-colors">
      {/* Icon/Preview - clickable */}
      <button
        type="button"
        onClick={() => onOpen(attachment)}
        className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded"
      >
        {isImage(attachment.type) ? (
          <img
            src={`${attachmentUrl}/thumbnail`}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
        ) : (
          <FileIcon className="text-muted-foreground h-8 w-8" />
        )}
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(attachment)}
          className="truncate font-medium hover:underline"
        >
          {attachment.name}
        </button>
        <p className="text-muted-foreground text-sm">
          {formatFileSize(attachment.size)} &middot;{' '}
          {formatTimestamp(attachment.created)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpen(attachment)}
          aria-label={t`Open attachment`}
          title={t`Open`}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCopy(attachment)}
          aria-label={t`Copy embed link`}
          title={t`Copy embed link`}
        >
          {copiedId === attachment.id ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(attachment)}
          disabled={isDeleting}
          className="text-muted-foreground"
          aria-label={t`Delete attachment`}
          title={t`Delete`}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function AttachmentsPageSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
          <Skeleton className="h-16 w-16 shrink-0 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export { AttachmentsPageSkeleton }
