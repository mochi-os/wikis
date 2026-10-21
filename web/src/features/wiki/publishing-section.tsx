// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// Where a public wiki of the user's own publishes its pages: the owner's
// accounts on other networks, each switched on or off for the wiki, and for
// one new page in the editor. Removing an account offers to delete the copies
// already there, keeping them by default.
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  PublishAccount,
  PublishResponse,
  PublishSetResponse,
} from '@/types/wiki'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  ConfirmDialog,
  GeneralError,
  Label,
  Section,
  Switch,
  getErrorMessage,
  naturalCompare,
  providerName,
  requestHelpers,
  toast,
} from '@mochi/web'
import { Archive } from 'lucide-react'
import endpoints from '@/api/endpoints'
import { useEntityEndpoint } from '@/hooks/use-wiki'

function usePublish() {
  const e = useEntityEndpoint()
  const query = useQuery({
    queryKey: ['wiki', 'publish', e('')],
    queryFn: () =>
      requestHelpers.get<PublishResponse>(e(endpoints.wiki.publish)),
    retry: false,
  })
  return { e, query }
}

export function PublishingSection() {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { e, query } = usePublish()
  const { data, isLoading, error, refetch } = query
  const [busy, setBusy] = useState<string | null>(null)
  const [kept, setKept] = useState<{
    account: PublishAccount
    count: number
  } | null>(null)

  const accounts = [...(data?.accounts ?? [])].sort((a, b) =>
    naturalCompare(a.identifier, b.identifier)
  )
  const publish = data?.publish ?? []

  // Only a public wiki publishes, and only to an account the user holds; as
  // for every user while the networks are off, there is otherwise nothing to
  // choose, so nothing shows while it is asked.
  if (isLoading || (!error && (accounts.length === 0 || !data?.public))) {
    return null
  }

  const toggle = async (account: PublishAccount, on: boolean) => {
    setBusy(account.id)
    const next = on
      ? [...publish, account.id]
      : publish.filter((id) => id !== account.id)
    try {
      const answer = await requestHelpers.post<PublishSetResponse>(
        e(endpoints.wiki.publishSet),
        { accounts: JSON.stringify(next) }
      )
      await queryClient.invalidateQueries({ queryKey: ['wiki', 'publish'] })
      if (!on && answer.kept[account.id]) {
        setKept({ account, count: answer.kept[account.id] })
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t`Could not save the accounts`))
    } finally {
      setBusy(null)
    }
  }

  const forget = async (account: PublishAccount) => {
    try {
      const answer = await requestHelpers.post<{ deleted: number }>(
        e(endpoints.wiki.publishForget),
        { account: account.id }
      )
      toast.success(t`Deleted ${answer.deleted} copies`)
      await refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, t`Could not delete the copies`))
    }
  }

  return (
    <Section title={t`Publish to`}>
      {error ? (
        <GeneralError error={error} minimal mode='inline' reset={refetch} />
      ) : (
        <div>
          {accounts.map((account) => (
            <div
              key={account.id}
              className='flex items-center justify-between gap-4 py-2'
            >
              <div className='min-w-0'>
                <div className='truncate text-sm font-medium'>
                  {account.identifier}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {providerName(account.type)}
                  {data?.copies[account.id]
                    ? ' · ' +
                      plural(data.copies[account.id], {
                        one: '# copy',
                        other: '# copies',
                      })
                    : ''}
                </div>
              </div>
              <Switch
                checked={publish.includes(account.id)}
                disabled={busy === account.id}
                aria-label={t`Publish to ${account.identifier}`}
                onCheckedChange={(on) => void toggle(account, on)}
              />
            </div>
          ))}
        </div>
      )}
      {kept && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setKept(null)
          }}
          title={t`Delete the copies on ${kept.account.identifier}?`}
          desc={t`Copies published there: ${kept.count}. They stay unless you delete them.`}
          confirmText={t`Delete copies`}
          cancelBtnText={t`Keep`}
          icon={<Archive className='size-4' />}
          destructive
          handleConfirm={async () => {
            const account = kept.account
            setKept(null)
            await forget(account)
          }}
        />
      )}
    </Section>
  )
}

/**
 * The accounts one new page goes to, preset from the wiki's list. Shown only
 * to the owner of a public wiki with an account to choose.
 */
export function PublishSwitches({
  chosen,
  onChange,
}: {
  /** The accounts chosen for this page, or null to follow the wiki's list. */
  chosen: string[] | null
  onChange: (accounts: string[]) => void
}) {
  const { data } = usePublish().query
  const accounts = [...(data?.accounts ?? [])].sort((a, b) =>
    naturalCompare(a.identifier, b.identifier)
  )
  if (accounts.length === 0 || !data?.public) return null
  const selected = chosen ?? data.publish
  return (
    <div className='space-y-2'>
      <Label>
        <Trans>Publish to</Trans>
      </Label>
      <div className='flex flex-wrap gap-3'>
        {accounts.map((account) => (
          <label key={account.id} className='flex items-center gap-2 text-sm'>
            <Switch
              checked={selected.includes(account.id)}
              aria-label={account.identifier}
              onCheckedChange={(on) =>
                onChange(
                  on
                    ? [...selected, account.id]
                    : selected.filter((id) => id !== account.id)
                )
              }
            />
            {account.identifier}
          </label>
        ))}
      </div>
    </div>
  )
}
