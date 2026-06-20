// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect } from 'react'
import { plural, t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Search, FileText, ArrowRight } from 'lucide-react'
import { EmptyState, useFormat, GeneralError, Input, ListSkeleton, Separator } from '@mochi/web'
import { useSearch } from '@/hooks/use-wiki'
import type { SearchResult } from '@/types/wiki'

interface SearchPageProps {
  initialQuery?: string
  wikiId?: string
  onQueryChange?: (q: string) => void
}

export function SearchPage({ initialQuery = '', wikiId, onQueryChange }: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Sync debounced query back to the URL via the router
  useEffect(() => {
    if (debouncedQuery !== initialQuery) {
      onQueryChange?.(debouncedQuery)
    }
  }, [debouncedQuery, initialQuery, onQueryChange])

  const { data, isLoading, error, refetch } = useSearch(debouncedQuery)
  const results = data?.results ?? []

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t`Search pages by title or content...`}
          className="ps-10"
          autoFocus
        />
      </div>

      <Separator />

      {/* Results */}
      {!debouncedQuery ? (
        <EmptyState
          icon={Search}
          title={t`Enter a search term`}
          description={t`Search pages by title or content.`}
          className="py-8"
        />
      ) : isLoading ? (
        <ListSkeleton variant="card" count={5} />
      ) : error ? (
        <GeneralError error={error} minimal mode="inline" reset={refetch} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t`No pages found for "${debouncedQuery}"`}
          description={t`Try different search terms.`}
          className="py-8"
        />
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            <Trans>Found {plural(results.length, { one: '# result', other: '# results' })} for "{debouncedQuery}"</Trans>
          </p>
          <div className="space-y-2">
            {results.map((result) => (
              <SearchResultItem key={result.page} result={result} wikiId={wikiId} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SearchResultItemProps {
  result: SearchResult
  wikiId?: string
}

function SearchResultItem({ result, wikiId }: SearchResultItemProps) {
  const { formatTimestamp } = useFormat()
  return (
    <Link
      to={wikiId ? '/$wikiId/$page' : '/$page'}
      params={wikiId ? { wikiId, page: result.page } : { page: result.page }}
      className="hover:bg-hover group flex items-start gap-4 rounded-lg border p-4 transition-colors"
    >
      <FileText className="text-muted-foreground mt-1 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold group-hover:underline">{result.title}</h3>
          <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
          {result.excerpt}...
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          <Trans>Updated {formatTimestamp(result.updated)}</Trans>
        </p>
      </div>
    </Link>
  )
}
