// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useLingui } from '@lingui/react/macro'
import { extractStatus, getErrorMessage } from '@mochi/web'

export const ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.txt,.md'

const ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
])

export function isSupportedAttachmentFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    return true
  }

  const name = file.name.toLowerCase()
  for (const ext of ATTACHMENT_EXTENSIONS) {
    if (name.endsWith(ext)) {
      return true
    }
  }

  return false
}

// The two upload surfaces - the page editor's insert dialog and the
// attachments page - had byte-identical copies of both messages. They are one
// contract with the server, so they live in one place.
export function useAttachmentUploadMessages() {
  const { t } = useLingui()

  const validate = (files: File[]) => {
    const unsupported = files.filter((file) => !isSupportedAttachmentFile(file))
    if (unsupported.length === 0) {
      return null
    }

    const names = unsupported.slice(0, 3).map((file) => file.name).join(', ')
    return unsupported.length === 1
      ? t`Unsupported file type: ${names}. Supported files: images, PDF, DOC, DOCX, TXT, and MD.`
      : t`Unsupported file types: ${names}. Supported files: images, PDF, DOC, DOCX, TXT, and MD.`
  }

  const describe = (error: unknown) => {
    if (extractStatus(error) === 413) {
      return t`This file is too large for the current server upload limit. Try a smaller file or increase the server or proxy upload size limit.`
    }

    // Everything else: show the server's own message. It arrives translated
    // for the request's language, so the substring tests that used to sit here
    // ("storage limit exceeded", "file too large", "Network Error") matched
    // only for an English reader and silently fell through for everyone else.
    // Axios reports a transport failure as the untranslated literal
    // "Network Error"; show the app's own translated fallback rather than
    // handing the reader an English string.
    const message = getErrorMessage(error, t`Failed to upload files`)
    return !message || message === 'Network Error' ? t`Failed to upload files` : message
  }

  return { validate, describe }
}
