// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { toast } from '@mochi/web'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttachmentsPage } from './attachments-page'

const updateAttachment = vi.hoisted(() => vi.fn())

vi.mock('@/context/wiki-base-url-context', () => ({
  useWikiBaseURL: () => ({ baseURL: '/wikis/w1/' }),
  useWikiBaseURLOptional: () => ({ baseURL: '/wikis/w1/' }),
}))
vi.mock('@/hooks/use-wiki', () => ({
  useAttachments: () => ({
    data: {
      attachments: [
        {
          id: 'a1',
          name: 'photo.png',
          type: 'image/png',
          size: 10,
          created: 1,
        },
      ],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUploadAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateAttachment: () => ({ mutateAsync: updateAttachment }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
}))
// The caption dialog is lib/web's; here it saves a fixed caption.
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  AttachmentCaptionDialog: ({
    onSave,
  }: {
    onSave: (caption: string) => void
  }) => <button onClick={() => onSave('Sunset')}>Save caption</button>,
}))

function show() {
  return render(
    <I18nProvider i18n={i18n}>
      <AttachmentsPage />
    </I18nProvider>
  )
}

function caption() {
  fireEvent.click(screen.getByRole('button', { name: 'Add caption' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save caption' }))
}

// The caption shows on save and goes back if the server refuses. The error is
// taken from the request's own promise, so it still shows once the page that
// sent it has gone.
describe('AttachmentsPage caption', () => {
  beforeEach(() => {
    updateAttachment.mockReset()
    vi.restoreAllMocks()
  })

  it('says so when the server refuses', async () => {
    const error = vi.spyOn(toast, 'error')
    updateAttachment.mockRejectedValue({ response: { status: 500 } })
    show()
    caption()
    expect(updateAttachment).toHaveBeenCalledWith({
      id: 'a1',
      caption: 'Sunset',
    })
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('Failed to save caption')
    )
  })

  it('still says so after the page has gone', async () => {
    const error = vi.spyOn(toast, 'error')
    let refuse!: (reason: unknown) => void
    updateAttachment.mockReturnValue(
      new Promise((_resolve, reject) => {
        refuse = reject
      })
    )
    const view = show()
    caption()
    view.unmount()
    refuse({ response: { status: 500 } })
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('Failed to save caption')
    )
  })
})
