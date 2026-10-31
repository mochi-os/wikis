// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { wikiBaseURL } from '@/lib/wiki-base-url'
import { pageQuery } from '@/hooks/use-wiki'
import { WikiPageContent } from '@/features/wiki/wiki-page-content'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/')({
  // The address names the page, so its content is asked for beside the wiki's
  // info rather than once the view has mounted. Not awaited: the view's query
  // joins it.
  loader: ({ params, context }) => {
    void context.queryClient.prefetchQuery(
      pageQuery(wikiBaseURL(params.wikiId), params.page)
    )
  },
  component: WikiPageRoute,
})

function WikiPageRoute() {
  const { wikiId, page: slug } = Route.useParams()
  return <WikiPageContent wikiId={wikiId} slug={slug} />
}
