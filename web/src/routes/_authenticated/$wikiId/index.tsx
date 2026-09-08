// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { WikiPageContent } from '@/features/wiki/wiki-page-content'
import { isEntityContext } from '@/api/request'

export const Route = createFileRoute('/_authenticated/$wikiId/')({
  component: WikiHomePage,
})

function WikiHomePage() {
  const { wiki } = useWikiBaseURL()
  const { wikiId } = Route.useParams()

  // Decide by routing context, not by the shape of the segment. Testing it
  // against the entity-id pattern misread any nine-character base58 slug -
  // "resources", "reference", "questions" - as an entity and redirected the
  // reader to the home page, leaving those pages unreachable on a domain.
  if (isEntityContext()) {
    // Single-segment URL on an entity or domain route: the segment is a slug.
    return <WikiPageContent wikiId={wiki.fingerprint ?? wiki.id} slug={wikiId} domain />
  }

  // Redirect to the wiki's home page
  return <Navigate to="/$wikiId/$page" params={{ wikiId, page: wiki.home }} replace />
}
