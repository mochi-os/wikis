import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

export const Route = createFileRoute('/_authenticated/$wikiId/')({
  component: WikiHomePage,
})

function WikiHomePage() {
  const { wiki } = useWikiBaseURL()
  const { wikiId } = Route.useParams()

  // Redirect to the wiki's home page
  return <Navigate to="/$wikiId/$page" params={{ wikiId, page: wiki.home }} replace />
}
