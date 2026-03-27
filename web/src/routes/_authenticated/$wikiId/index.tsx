import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { WikiPageContent } from '@/features/wiki/wiki-page-content'

const ENTITY_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

export const Route = createFileRoute('/_authenticated/$wikiId/')({
  component: WikiHomePage,
})

function WikiHomePage() {
  const { wiki } = useWikiBaseURL()
  const { wikiId } = Route.useParams()

  if (!ENTITY_ID_PATTERN.test(wikiId)) {
    // wikiId doesn't match a fingerprint/entity ID — it's actually a page slug
    // (domain-routed page where the URL segment was mismatched as $wikiId)
    return <WikiPageContent wikiId={wiki.fingerprint ?? wiki.id} slug={wikiId} />
  }

  // Redirect to the wiki's home page
  return <Navigate to="/$wikiId/$page" params={{ wikiId, page: wiki.home }} replace />
}
