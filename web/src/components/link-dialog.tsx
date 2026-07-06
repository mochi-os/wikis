// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Copy } from 'lucide-react'
import {
  Button,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  getErrorMessage,
  shellClipboardWrite,
  toast,
} from '@mochi/web'
import { wikisRequest } from '@/api/request'

// Share-link dialog for a wiki the user owns: shows the mochi://<peer>/<wiki>
// URI with a copy button. The link conveys location only - access to a private
// wiki still requires view grants (#209).
export function useWikiLinkDialog(wikiId: string | undefined) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const openLinkDialog = async () => {
    if (!wikiId) return
    setLink('')
    setCopied(false)
    setOpen(true)
    try {
      const response = await wikisRequest.post<{ data?: { link: string }; link?: string }>(
        `${wikiId}/-/share`,
        {}
      )
      setLink(response.data?.link ?? response.link ?? '')
    } catch (error) {
      setOpen(false)
      toast.error(getErrorMessage(error, t`Failed to create link`))
    }
  }

  const copyLink = async () => {
    if (!link) return
    const ok = await shellClipboardWrite(link)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const linkDialog = (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>Wiki link</Trans></ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            <Trans>Anyone you give access to can subscribe with this link.</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className='bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm'>
          <code className='flex-1 break-all'>{link || '…'}</code>
          <Button variant='ghost' size='sm' onClick={() => void copyLink()} disabled={!link} className='shrink-0'>
            {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
          </Button>
        </div>
        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}><Trans>Done</Trans></Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )

  return { openLinkDialog, linkDialog }
}
