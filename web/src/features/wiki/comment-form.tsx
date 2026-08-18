// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useState } from 'react'
import { CommentBox, useDiscardGuard, type Upload } from '@mochi/web'

interface CommentFormProps {
  onSubmit: (body: string, files?: File[]) => void | Promise<void>
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
  /** Byte progress of an in-flight comment upload */
  progress?: Upload | null
}

/**
 * The page-level comment composer: the shared CommentBox with the draft and
 * its discard guard held here. The box owns its files and reports their
 * count; clearing it in place means remounting it (the key), since a
 * composer that is always on screen has nothing to close.
 */
export function CommentForm({ onSubmit, onCancel, placeholder, autoFocus, progress }: CommentFormProps) {
  const [body, setBody] = useState('')
  const [fileCount, setFileCount] = useState(0)
  const [boxKey, setBoxKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Rejects on failure so the box keeps the draft and its files for Retry;
  // the caller already reported the error.
  const handleSubmit = useCallback(
    async (trimmed: string, files?: File[]) => {
      setIsSubmitting(true)
      try {
        await onSubmit(trimmed, files)
        setBody('')
      } finally {
        setIsSubmitting(false)
      }
    },
    [onSubmit]
  )

  const hasDraft = body.trim().length > 0 || fileCount > 0

  // The page-level composer has nothing to close, so discarding clears the
  // form in place. A nested form (with onCancel) closes as well.
  const discard = useCallback(() => {
    setBody('')
    setFileCount(0)
    setBoxKey((key) => key + 1)
    onCancel?.()
  }, [onCancel])

  const { requestClose, discardDialog } = useDiscardGuard({
    hasText: body.trim().length > 0,
    hasFiles: fileCount > 0,
    onDiscard: discard,
    locked: isSubmitting,
  })

  return (
    <div>
      <CommentBox
        key={boxKey}
        value={body}
        onValueChange={setBody}
        onSubmit={handleSubmit}
        // Cancel when there is a form to close, or a draft to discard.
        onClose={onCancel || hasDraft ? requestClose : undefined}
        onFilesChange={setFileCount}
        progress={progress}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
        textareaClassName='bg-background rounded-lg text-sm'
      />
      {discardDialog}
    </div>
  )
}
