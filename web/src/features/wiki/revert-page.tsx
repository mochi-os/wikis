// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useNavigate } from '@tanstack/react-router'
import { RotateCcw, ArrowLeft } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Separator,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  getErrorMessage,
  toast,
} from '@mochi/web'
import { useRevertPage } from '@/hooks/use-wiki'

interface RevertPageProps {
  slug: string
  version: number
  wikiId?: string
}

export function RevertPage({ slug, version, wikiId }: RevertPageProps) {
  const { t } = useLingui()
  const revertPage = useRevertPage()
  const navigate = useNavigate()
  const [comment, setComment] = useState(t`Reverted to version ${version}`)

  const handleRevert = () => {
    revertPage.mutate(
      { slug, version, comment },
      {
        onSuccess: () => {
          toast.success(t`Reverted to version ${version}`)
          if (wikiId) {
            void navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
          } else {
            void navigate({ to: '/$page', params: { page: slug } })
          }
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to revert page`))
        },
      }
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            <Trans>Revert page</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>
              You are about to revert <strong>{slug}</strong> to version{' '}
              <strong>{version}</strong>. This will create a new revision with the
              content from version {version}.
            </Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="comment"><Trans>Revert comment</Trans></Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t`Reason for reverting`}
            />
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button variant="outline" asChild>
            {wikiId ? (
              <Link preload={false} to="/$wikiId/$page/history" params={{ wikiId, page: slug }}>
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                <Trans>Cancel</Trans>
              </Link>
            ) : (
              <Link preload={false} to="/$page/history" params={{ page: slug }}>
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                <Trans>Cancel</Trans>
              </Link>
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevert}
            disabled={revertPage.isPending}
          >
            <RotateCcw className="me-2 h-4 w-4" />
            {revertPage.isPending ? t`Reverting...` : t`Revert`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
