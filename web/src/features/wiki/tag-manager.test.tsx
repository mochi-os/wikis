// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { toast } from '@mochi/web'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TagManager } from './tag-manager'

const removeTag = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/context/wiki-context', () => ({
  usePermissions: () => ({ edit: true }),
}))
vi.mock('@/hooks/use-wiki', () => ({
  useAddTag: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveTag: () => ({ mutateAsync: removeTag, isPending: false }),
}))

function show() {
  return render(
    <I18nProvider i18n={i18n}>
      <TagManager slug='install' tags={['setup']} />
    </I18nProvider>
  )
}

// The chip goes on the click and comes back if the server refuses. The error
// is taken from the request's own promise, so it still shows once the page
// that sent it has gone.
describe('TagManager remove', () => {
  beforeEach(() => {
    removeTag.mockReset()
    vi.restoreAllMocks()
  })

  it('says so when the server refuses', async () => {
    const error = vi.spyOn(toast, 'error')
    removeTag.mockRejectedValue({ response: { status: 500 } })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('Failed to remove tag')
    )
  })

  it('still says so after the page has gone', async () => {
    const error = vi.spyOn(toast, 'error')
    let refuse!: (reason: unknown) => void
    removeTag.mockReturnValue(
      new Promise((_resolve, reject) => {
        refuse = reject
      })
    )
    const view = show()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    view.unmount()
    refuse({ response: { status: 500 } })
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('Failed to remove tag')
    )
  })
})
