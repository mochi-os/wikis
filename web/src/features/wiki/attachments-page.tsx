import { useState, useRef, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { toast } from 'sonner'
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
  ArrowLeft,
  X,
  Image,
} from 'lucide-react'
import {
  Button,
  getApiBasepath,
  Input,
  Skeleton,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  formatFileSize,
  getFileIcon,
  isImage,
  getErrorMessage,
} from '@mochi/common'
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/use-wiki'
import type { Attachment } from '@/types/wiki'

interface AttachmentsPageProps {
  slug: string
}

type ViewMode = 'grid' | 'list'
type FilterType = 'all' | 'images' | 'documents'
type SortBy = 'name' | 'date' | 'size'

// Build attachment URL using API basepath for correct resolution from any route
function getAttachmentUrl(id: string): string {
  return `${getApiBasepath()}attachments/${id}`
}

export function AttachmentsPage({ slug }: AttachmentsPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useAttachments()
  const uploadMutation = useUploadAttachment()
  const deleteMutation = useDeleteAttachment()

  const attachments = data?.attachments || []

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
          return a.name.localeCompare(b.name)
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

  const handleUpload = (files: FileList | File[]) => {
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

    navigator.clipboard.writeText(markdown)
    setCopiedId(attachment.id)
    toast.success('Copied markdown to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (attachment: Attachment) => {
    if (confirm(`Delete "${attachment.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(attachment.id, {
        onSuccess: () => {
          toast.success('Attachment deleted')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to delete attachment'))
        },
      })
    }
  }

  const imageCount = attachments.filter((a) => isImage(a.type)).length
  const documentCount = attachments.length - imageCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/$page/edit" params={{ page: slug }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Attachments</h1>
            <p className="text-muted-foreground text-sm">
              {attachments.length} file{attachments.length !== 1 ? 's' : ''} ({imageCount} images, {documentCount} documents)
            </p>
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.md"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload files
          </Button>
        </div>
      </div>

      <Separator />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search attachments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter */}
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All files</SelectItem>
            <SelectItem value="images">Images</SelectItem>
            <SelectItem value="documents">Documents</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[130px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Drop zone / Content */}
      <div
        className={`min-h-[400px] rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-transparent'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <AttachmentsPageSkeleton viewMode={viewMode} />
        ) : filteredAttachments.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center text-center">
            <Image className="text-muted-foreground mb-4 h-12 w-12" />
            {attachments.length === 0 ? (
              <>
                <p className="text-muted-foreground mb-2">No attachments yet</p>
                <p className="text-muted-foreground text-sm">
                  Drag and drop files here, or click "Upload files" to get started.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No attachments match your search
              </p>
            )}
          </div>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface AttachmentItemProps {
  attachment: Attachment
  copiedId: string | null
  isDeleting: boolean
  onCopy: (attachment: Attachment) => void
  onDelete: (attachment: Attachment) => void
}

function AttachmentGridItem({
  attachment,
  copiedId,
  isDeleting,
  onCopy,
  onDelete,
}: AttachmentItemProps) {
  const FileIcon = getFileIcon(attachment.type)

  return (
    <div className="group bg-card hover:bg-muted/50 relative overflow-hidden rounded-lg border transition-colors">
      {/* Preview */}
      <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden">
        {isImage(attachment.type) ? (
          <img
            src={`${getAttachmentUrl(attachment.id)}/thumbnail`}
            alt={attachment.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileIcon className="text-muted-foreground h-12 w-12" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatFileSize(attachment.size)}
        </p>
      </div>

      {/* Actions overlay */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onCopy(attachment)}
          title="Copy markdown"
        >
          {copiedId === attachment.id ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onDelete(attachment)}
          disabled={isDeleting}
          title="Delete"
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
}: AttachmentItemProps) {
  const FileIcon = getFileIcon(attachment.type)

  return (
    <div className="hover:bg-muted/50 flex items-center gap-4 rounded-lg border p-3 transition-colors">
      {/* Icon/Preview */}
      <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded">
        {isImage(attachment.type) ? (
          <img
            src={`${getAttachmentUrl(attachment.id)}/thumbnail`}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
        ) : (
          <FileIcon className="text-muted-foreground h-8 w-8" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{attachment.name}</p>
        <p className="text-muted-foreground text-sm">
          {formatFileSize(attachment.size)} &middot;{' '}
          {format(new Date(attachment.created * 1000), 'PPp')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCopy(attachment)}
          title="Copy markdown"
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
          className="text-destructive hover:text-destructive"
          title="Delete"
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
