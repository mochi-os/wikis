import { createFileRoute, Navigate } from '@tanstack/react-router'
import { isDomainEntityRouting } from '@mochi/common'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { WikiPageContent } from '@/features/wiki/wiki-page-content'

const ENTITY_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

export const Route = createFileRoute('/_authenticated/$wikiId/')({
  component: WikiHomePage,
})

function WikiHomePage() {
  const { wiki } = useWikiBaseURL()
  const { wikiId } = Route.useParams()

  if (isDomainEntityRouting() && !ENTITY_ID_PATTERN.test(wikiId)) {
    // In domain routing, TanStack Router matched $wikiId when the URL segment is actually
    // a page slug (e.g., /install). Render the page directly at this URL.
    return <WikiPageContent wikiId={wiki.fingerprint ?? wiki.id} slug={wikiId} />
  }

  // Redirect to the wiki's home page
  return <Navigate to="/$wikiId/$page" params={{ wikiId, page: wiki.home }} replace />
}
