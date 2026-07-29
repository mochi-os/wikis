// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useState, useRef } from 'react'
import {
  IconButton,
  useImageObjectUrls,
  cn,
  removePendingFile,
  ComposerAttachments,
  SendShortcutHint,
  dropActiveClass,
  offlineBlocked,
  useComposerDrop,
  useDiscardGuard,
} from '@mochi/web'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
import { t } from '@lingui/core/macro'

interface CommentFormProps {
  onSubmit: (body: string, files?: File[]) => void | Promise<void>
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentForm({ onSubmit, onCancel, placeholder, autoFocus }: CommentFormProps) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const filePreviewUrls = useImageObjectUrls(files)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((incoming: File[]) => {
    setFailed(false)
    setFiles((prev) => [...prev, ...incoming])
  }, [])

  const { isDragActive, dropzoneProps } = useComposerDrop({
    onFiles: addFiles,
    disabled: isSubmitting,
  })

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed || isSubmitting || offlineBlocked()) return
    setIsSubmitting(true)
    setFailed(false)
    try {
      await onSubmit(trimmed, files.length > 0 ? files : undefined)
      setBody('')
      setFiles([])
    } catch {
      // Keep the draft and the files staged so Retry can send them again;
      // the caller already reported the error.
      setFailed(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasDraft = body.trim().length > 0 || files.length > 0

  // The page-level composer has nothing to close, so discarding clears the
  // form in place. A nested form (with onCancel) closes as well.
  const discard = useCallback(() => {
    setBody('')
    setFiles([])
    setFailed(false)
    onCancel?.()
  }, [onCancel])

  const { requestClose, discardDialog } = useDiscardGuard({
    hasText: body.trim().length > 0,
    hasFiles: files.length > 0,
    onDiscard: discard,
    locked: isSubmitting,
  })

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSubmit()
    } else if (e.key === 'Escape') {
      requestClose()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  const removeFile = (file: File) => {
    setFiles((prev) => removePendingFile(prev, file))
  }

  return (
    <div
      className={cn('space-y-2', isDragActive && dropActiveClass)}
      {...dropzoneProps}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-input bg-background placeholder:text-muted-foreground min-h-16 w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        rows={3}
        autoFocus={autoFocus}
        disabled={isSubmitting}
      />
      <ComposerAttachments
        files={files}
        previewUrls={filePreviewUrls}
        state={isSubmitting ? 'uploading' : failed ? 'error' : 'idle'}
        onRemove={removeFile}
        onRetry={() => void handleSubmit()}
      />
      <div className="flex items-center justify-end gap-2">
        <SendShortcutHint />
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
          disabled={isSubmitting}
          label={t`Attach files`}
        >
          <Paperclip className="size-4" />
        </IconButton>
        {(onCancel || hasDraft) && (
          <IconButton
            type='button'
            variant='ghost'
            className='size-8'
            onClick={requestClose}
            disabled={isSubmitting}
            label={t`Cancel comment`}
          >
            <X className="size-4" />
          </IconButton>
        )}
        <IconButton
          type='button'
          className='size-8'
          disabled={!body.trim() || isSubmitting}
          onClick={() => void handleSubmit()}
          label={t`Send comment`}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </IconButton>
      </div>
      {discardDialog}
    </div>
  )
}
