import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { Upload, Trash2, Image, FileText, File, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/use-wiki'
import type { Attachment } from '@/types/wiki'
import endpoints from '@/api/endpoints'

interface AttachmentPickerProps {
  onSelect?: (attachment: Attachment, markdown: string) => void
  onDelete?: (attachmentId: string) => void
  trigger?: React.ReactNode
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image
  if (type.startsWith('text/')) return FileText
  return File
}

function isImage(type: string): boolean {
  return type.startsWith('image/')
}

export function AttachmentPicker({ onSelect, onDelete, trigger }: AttachmentPickerProps) {
  const [open, setOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useAttachments()
  const uploadMutation = useUploadAttachment()
  const deleteMutation = useDeleteAttachment()

  const attachments = data?.attachments || []

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadMutation.mutate(files)
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Build relative URL for attachments in markdown (resolved at render time)
  // Images default to thumbnail, non-images get direct URL
  const getAttachmentUrl = (id: string, type: string) => {
    if (type.startsWith('image/')) {
      return `attachments/${id}/thumbnail`
    }
    return `attachments/${id}`
  }

  const handleSelect = (attachment: Attachment) => {
    const url = getAttachmentUrl(attachment.id, attachment.type)
    const markdown = isImage(attachment.type)
      ? `![${attachment.name}](${url})`
      : `[${attachment.name}](${url})`

    if (onSelect) {
      onSelect(attachment, markdown)
      setOpen(false)
    }
  }

  const handleCopy = (attachment: Attachment) => {
    // Copy uses full URL (not thumbnail) for direct linking
    const url = `attachments/${attachment.id}`
    const markdown = isImage(attachment.type)
      ? `![${attachment.name}](${url})`
      : `[${attachment.name}](${url})`

    navigator.clipboard.writeText(markdown)
    setCopiedId(attachment.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this attachment?')) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          if (onDelete) {
            onDelete(id)
          }
        }
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Image className="mr-2 h-4 w-4" />
            Attachments
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attachments</DialogTitle>
          <DialogDescription>
            Upload and manage wiki attachments. Click an attachment to insert it into the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>

          {/* Attachments list */}
          <ScrollArea className="h-[400px] rounded-md border p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center py-8 text-center">
                No attachments yet. Upload files to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((attachment) => {
                  const FileIcon = getFileIcon(attachment.type)
                  return (
                    <div
                      key={attachment.id}
                      className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                    >
                      {/* Icon/Preview */}
                      <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded">
                        {isImage(attachment.type) ? (
                          <img
                            src={`${endpoints.wiki.attachment(attachment.id)}/thumbnail`}
                            alt=""
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <FileIcon className="text-muted-foreground h-6 w-6" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {attachment.name}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {formatFileSize(attachment.size)} •{' '}
                          {format(new Date(attachment.created * 1000), 'PP')}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        {onSelect && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelect(attachment)}
                          >
                            Insert
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(attachment)}
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
                          onClick={() => handleDelete(attachment.id)}
                          disabled={deleteMutation.isPending && deleteMutation.variables === attachment.id}
                          className="text-destructive hover:text-destructive"
                          title="Delete attachment"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === attachment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
