// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import {
  Button,
  IconButton,
  useImageObjectUrls,
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  useFormat,
  pendingFileKey,
  removePendingFile,
} from '@mochi/web'
import { Paperclip, Send, X } from 'lucide-react'
import { t } from '@lingui/core/macro'

interface CommentFormProps {
  onSubmit: (body: string, files?: File[]) => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentForm({ onSubmit, onCancel, placeholder, autoFocus }: CommentFormProps) {
  const { formatFileSize } = useFormat()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const filePreviewUrls = useImageObjectUrls(files)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    onSubmit(trimmed, files.length > 0 ? files : undefined)
    setBody('')
    setFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape' && onCancel) {
      onCancel()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
    e.target.value = ''
  }

  const removeFile = (file: File) => {
    setFiles((prev) => removePendingFile(prev, file))
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-input bg-background min-h-16 w-full rounded-lg border px-3 py-2 text-sm"
        rows={3}
        autoFocus={autoFocus}
      />
      {files.length > 0 && (
        <AttachmentGroup>
          {files.map((file, i) => {
            const isImage = file.type.startsWith('image/')
            return (
              <Attachment key={pendingFileKey(file)} state="uploading" size="sm">
                <AttachmentMedia variant={isImage ? "image" : "icon"}>
                  {isImage && filePreviewUrls[i] ? (
                    <img src={filePreviewUrls[i] ?? undefined} alt={file.name} draggable={false} />
                  ) : (
                    <Paperclip />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{file.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {formatFileSize(file.size)}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction onClick={() => removeFile(file)} aria-label={t`Remove`}>
                    <X className="size-4" />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            )
          })}
        </AttachmentGroup>
      )}
      <div className="flex items-center justify-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <IconButton
          type='button'
          variant='ghost'
          className='size-8'
          onClick={() => fileInputRef.current?.click()}
          label={t`Attach files`}
        >
          <Paperclip className="size-4" />
        </IconButton>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
        )}
        <IconButton
          type='button'
          className='size-8'
          disabled={!body.trim()}
          onClick={handleSubmit}
          label={t`Send comment`}
        >
          <Send className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
