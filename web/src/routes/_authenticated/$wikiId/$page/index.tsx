import { createFileRoute } from '@tanstack/react-router'
import { WikiPageContent } from '@/features/wiki/wiki-page-content'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/')({
  component: WikiPageRoute,
})

function WikiPageRoute() {
  const { wikiId, page: slug } = Route.useParams()
  return <WikiPageContent wikiId={wikiId} slug={slug} />
}
