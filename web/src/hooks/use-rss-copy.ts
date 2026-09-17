// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useLingui } from '@lingui/react/macro'
import {
  toast,
  getErrorMessage,
  getAppPath,
  shellClipboardWrite,
} from '@mochi/web'
import { getRssToken, revokeRssToken } from '@/api/request'

// Copying an RSS URL and revoking RSS access were written out three times -
// the landing page, the all-wikis list and the class-context page view - and
// had already drifted: only two of the three offered "Revoke access".
//
// `wiki` is the wiki's id, or "*" for the cross-wiki feed, which the server
// serves from the class-level route rather than a wiki-scoped one.
export function useRssCopy(wiki: string) {
  const { t } = useLingui()

  const copy = async (
    mode: 'changes' | 'comments' | 'all',
    regenerate = false
  ) => {
    try {
      const { token, exists } = await getRssToken(wiki, mode, regenerate)
      // Only the hash is stored; replacing the issued URL is the user's call,
      // since it breaks any reader polling it.
      if (exists) {
        toast.info(
          t`This feed URL was already issued and cannot be shown again.`,
          {
            action: { label: t`Replace`, onClick: () => void copy(mode, true) },
          }
        )
        return
      }
      const path =
        wiki === '*' ? `${getAppPath()}/rss` : `${getAppPath()}/${wiki}/rss`
      const url = new URL(`${path}?token=${token}`, window.location.href).href
      if (await shellClipboardWrite(url)) {
        toast.success(
          regenerate
            ? t`New RSS URL copied to clipboard`
            : t`RSS URL copied to clipboard`
        )
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to get RSS token`))
    }
  }

  const revoke = async () => {
    try {
      await revokeRssToken(wiki)
      toast.success(t`RSS access revoked`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to revoke RSS access`))
    }
  }

  return { copy, revoke }
}
