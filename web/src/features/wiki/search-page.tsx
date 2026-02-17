import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, FileText, ArrowRight } from 'lucide-react'
import { EmptyState, GeneralError, Input, ListSkeleton, Separator } from '@mochi/common'
import { useSearch } from '@/hooks/use-wiki'
import type { SearchResult } from '@/types/wiki'

interface SearchPageProps {
  initialQuery?: string
}

export function SearchPage({ initialQuery = '' }: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Update URL when debounced query changes
  useEffect(() => {
    if (debouncedQuery !== initialQuery) {
      const params = new URLSearchParams(window.location.search)
      if (debouncedQuery) {
        params.set('q', debouncedQuery)
      } else {
        params.delete('q')
      }
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [debouncedQuery, initialQuery])

  const { data, isLoading, error } = useSearch(debouncedQuery)
  const results = data?.results ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Search className="h-6 w-6" />
          Search Wiki
        </h1>

        {/* Search input */}
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages by title or content..."
            className="pl-10"
            autoFocus
          />
        </div>
      </div>

      <Separator />

      {/* Results */}
      {!debouncedQuery ? (
        <EmptyState
          icon={Search}
          title="Enter a search term"
          description="Search pages by title or content."
          className="py-8"
        />
      ) : isLoading ? (
        <ListSkeleton variant="card" count={5} />
      ) : error ? (
        <GeneralError error={error} minimal mode="inline" />
      ) : results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No pages found for "${debouncedQuery}"`}
          description="Try different search terms."
          className="py-8"
        />
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Found {results.length} result
            {results.length !== 1 ? 's' : ''} for "{debouncedQuery}"
          </p>
          <div className="space-y-2">
            {results.map((result) => (
              <SearchResultItem key={result.page} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SearchResultItemProps {
  result: SearchResult
}

function SearchResultItem({ result }: SearchResultItemProps) {
  return (
    <a
      href={result.page}
      className="hover:bg-muted/50 group flex items-start gap-4 rounded-lg border p-4 transition-colors"
    >
      <FileText className="text-muted-foreground mt-1 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold group-hover:underline">{result.title}</h3>
          <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
          {result.excerpt}...
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Updated {format(new Date(result.updated * 1000), 'PPP')}
        </p>
      </div>
    </a>
  )
}
