// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { Attachment } from '@/types/wiki'
import { AttachmentGallery } from '@mochi/web'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { attachmentAddress } from './attachment-url'

interface CommentAttachmentsProps {
  attachments: Attachment[]
}

export function CommentAttachments({ attachments }: CommentAttachmentsProps) {
  const { baseURL } = useWikiBaseURL()

  // An attachment whose id has no address is left out.
  const shown = (attachments ?? []).filter(
    (att) => attachmentAddress(baseURL, att.id) !== undefined
  )
  if (shown.length === 0) return null

  return (
    <div className='mt-1'>
      <AttachmentGallery
        attachments={shown}
        getUrl={(att) => attachmentAddress(baseURL, att.id) ?? ''}
        getThumbnailUrl={(att) =>
          attachmentAddress(baseURL, att.id, '/thumbnail') ?? ''
        }
        rowHeight={80}
      />
    </div>
  )
}
