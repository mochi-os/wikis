// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import {
  AttachmentGallery,
  authenticatedUrl,
} from '@mochi/web'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { Attachment } from '@/types/wiki'

interface CommentAttachmentsProps {
  attachments: Attachment[]
}

export function CommentAttachments({ attachments }: CommentAttachmentsProps) {
  const { baseURL } = useWikiBaseURL()

  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mt-1">
      <AttachmentGallery
        attachments={attachments}
        getUrl={(att) => authenticatedUrl(`${baseURL}attachments/${att.id}`)}
        getThumbnailUrl={(att) => authenticatedUrl(`${baseURL}attachments/${att.id}/thumbnail`)}
        rowHeight={80}
      />
    </div>
  )
}
