import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, Loader2, BookOpen } from 'lucide-react'
import { Button, Input, toast } from '@mochi/common'
import { wikisRequest } from '@/api/request'
import endpoints from '@/api/endpoints'

interface DirectoryEntry {
  id: string
  name: string
  fingerprint: string
}

interface SearchResponse {
  data: DirectoryEntry[]
}

interface InlineWikiSearchProps {
  subscribedIds: Set<string>
  onRefresh?: () => void
}

export function InlineWikiSearch({ subscribedIds, onRefresh }: InlineWikiSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<DirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingWikiId, setPendingWikiId] = useState<string | null>(null)
  const navigate = useNavigate()

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([])
      return
    }

    const search = async () => {
      setIsLoading(true)
      try {
        const response = await wikisRequest.get<SearchResponse>(
          `${endpoints.wiki.directorySearch}?search=${encodeURIComponent(debouncedQuery)}`
        )
        setResults(response.data ?? [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    void search()
  }, [debouncedQuery])

  const handleSubscribe = async (wiki: DirectoryEntry) => {
    setPendingWikiId(wiki.id)
    try {
      await wikisRequest.post(endpoints.wiki.subscribe, { wiki: wiki.id })
      onRefresh?.()
      void navigate({ to: '/$wikiId/$page', params: { wikiId: wiki.fingerprint || wiki.id, page: 'home' } })
    } catch (error) {
      toast.error('Failed to join wiki', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      setPendingWikiId(null)
    }
  }

  const showResults = debouncedQuery.length > 0
  const showLoading = isLoading && debouncedQuery.length > 0

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search for wikis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 pl-9"
          autoFocus
        />
      </div>

      {/* Results */}
      {showLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && showResults && results.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No wikis found
        </p>
      )}

      {!isLoading && results.length > 0 && (
        <div className="divide-border divide-y rounded-lg border">
          {results
            .filter((wiki) => !subscribedIds.has(wiki.id) && !subscribedIds.has(wiki.fingerprint))
            .map((wiki) => {
              const isPending = pendingWikiId === wiki.id

              return (
                <div
                  key={wiki.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                      <BookOpen className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col text-left">
                      <span className="truncate text-sm font-medium">{wiki.name}</span>
                      {wiki.fingerprint && (
                        <span className="text-muted-foreground truncate text-xs">
                          {wiki.fingerprint.match(/.{1,3}/g)?.join('-')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSubscribe(wiki)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Join'
                    )}
                  </Button>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
