import {
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactNode,
  useEffect,
  useMemo,
} from 'react'
import { Link } from '@tanstack/react-router'
import {
  CopyButton,
  cn,
  getApiBasepath,
  ImageLightbox,
  type LightboxMedia,
  useLightboxHash,
} from '@mochi/common'
import { ExternalLink, Hash } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  classifyWikiLink,
  extractTocHeadings,
  slugifyHeading,
  type TocHeading,
} from './markdown-content.utils'

// Convert attachment URLs to absolute URLs for the current wiki
function resolveAttachmentUrl(url: string): string {
  // Handle relative attachments/id format (preferred)
  if (url.startsWith('attachments/')) {
    return `${getApiBasepath()}${url}`
  }
  // Handle legacy -/attachments/id format
  if (url.startsWith('-/attachments/')) {
    return `${getApiBasepath()}${url.slice(2)}`
  }
  // Handle absolute URLs from any wiki - extract attachment ID and optional suffix
  const match = url.match(/\/-\/attachments\/([^/?#]+)(\/thumbnail)?/)
  if (match) {
    return `${getApiBasepath()}attachments/${match[1]}${match[2] || ''}`
  }
  return url
}

// Get full-size URL for an attachment (removes /thumbnail suffix)
function getFullSizeUrl(url: string): string {
  const resolved = resolveAttachmentUrl(url)
  return resolved.replace(/\/thumbnail$/, '')
}

// Extract image URLs from markdown content before rendering
function extractImageUrls(content: string): string[] {
  const urls: string[] = []
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1])
  }
  return urls
}

function getNodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(getNodeText).join('')
  }
  if (isValidElement(node)) {
    return getNodeText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

interface MarkdownContentProps {
  content: string
  className?: string
  missingLinks?: string[]
  toc?: boolean
  onHeadingsChange?: (headings: TocHeading[]) => void
}

export function MarkdownContent({
  content,
  className,
  missingLinks = [],
  toc = false,
  onHeadingsChange,
}: MarkdownContentProps) {
  const headings = useMemo(() => extractTocHeadings(content), [content])
  const currentPathWithQuery =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : ''

  useEffect(() => {
    if (toc && onHeadingsChange) {
      onHeadingsChange(headings)
    }
  }, [toc, onHeadingsChange, headings])

  const lightboxMedia = useMemo<LightboxMedia[]>(() => {
    const urls = extractImageUrls(content)
    return urls.map((url, i) => ({
      id: String(i),
      name: url.split('/').pop() || 'Image',
      url: getFullSizeUrl(url),
      type: 'image' as const,
    }))
  }, [content])

  const srcToIndex = useMemo(() => {
    const map = new Map<string, number>()
    const urls = extractImageUrls(content)
    urls.forEach((url, i) => {
      map.set(resolveAttachmentUrl(url), i)
    })
    return map
  }, [content])

  const headingFallbackCounts = new Map<string, number>()
  let headingCursor = 0

  const resolveHeadingId = (level: 2 | 3 | 4, text: string) => {
    for (; headingCursor < headings.length; headingCursor += 1) {
      const candidate = headings[headingCursor]
      if (candidate.level === level) {
        headingCursor += 1
        return candidate.id
      }
    }

    const baseId = slugifyHeading(text)
    const nextCount = (headingFallbackCounts.get(baseId) ?? 0) + 1
    headingFallbackCounts.set(baseId, nextCount)
    return nextCount === 1 ? baseId : `${baseId}-${nextCount}`
  }

  const renderHeading =
    (level: 2 | 3 | 4, classes: string) =>
    ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => {
      const headingText = getNodeText(children).trim()
      const id = resolveHeadingId(level, headingText)
      const content = (
        <>
          <span>{children}</span>
          <a
            href={
              currentPathWithQuery
                ? `${currentPathWithQuery}#${id}`
                : `#${id}`
            }
            className='text-muted-foreground hover:text-foreground ml-2 inline-flex opacity-0 transition-opacity group-hover:opacity-100'
            aria-label={`Link to ${headingText}`}
          >
            <Hash className='size-3.5' />
          </a>
        </>
      )

      if (level === 2) {
        return (
          <h2 id={id} className={classes} {...props}>
            {content}
          </h2>
        )
      }

      if (level === 3) {
        return (
          <h3 id={id} className={classes} {...props}>
            {content}
          </h3>
        )
      }

      return (
        <h4 id={id} className={classes} {...props}>
          {content}
        </h4>
      )
    }

  const { open, currentIndex, openLightbox, closeLightbox, setCurrentIndex } =
    useLightboxHash(lightboxMedia)

  return (
    <>
      <div
        className={cn(
          'prose prose-neutral dark:prose-invert max-w-none',
          'prose-p:my-4 prose-p:leading-7',
          'prose-headings:scroll-mt-20 prose-headings:font-semibold prose-headings:tracking-tight',
          'prose-h2:mt-10 prose-h2:mb-3 prose-h2:text-2xl',
          'prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-xl',
          'prose-h4:mt-6 prose-h4:mb-2 prose-h4:text-lg',
          'prose-a:text-primary prose-a:decoration-primary/40 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/85',
          'prose-ul:my-4 prose-ul:space-y-2 prose-ul:marker:text-muted-foreground',
          'prose-ol:my-4 prose-ol:space-y-2 prose-ol:marker:text-muted-foreground',
          'prose-li:my-1',
          'prose-code:before:content-none prose-code:after:content-none',
          'prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em]',
          'prose-pre:bg-transparent prose-pre:p-0 prose-pre:shadow-none',
          'prose-table:border prose-th:border prose-td:border',
          'prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
          className
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: renderHeading(2, 'group flex items-center'),
            h3: renderHeading(3, 'group flex items-center'),
            h4: renderHeading(4, 'group flex items-center'),
            ul: ({ children, ...props }) => (
              <ul
                className='marker:text-muted-foreground my-4 space-y-1'
                {...props}
              >
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol
                className='marker:text-muted-foreground my-4 space-y-1'
                {...props}
              >
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className='pl-1' {...props}>
                {children}
              </li>
            ),
            img: ({ src, alt, node: _, ...props }) => {
              const resolvedSrc = src ? resolveAttachmentUrl(src) : src
              const index = resolvedSrc
                ? srcToIndex.get(resolvedSrc)
                : undefined

              if (index !== undefined) {
                return (
                  <button
                    type='button'
                    onClick={() => openLightbox(index)}
                    className='cursor-pointer border-0 bg-transparent p-0'
                  >
                    <img src={resolvedSrc} alt={alt} className='m-0' />
                  </button>
                )
              }

              return <img src={resolvedSrc} alt={alt} {...props} />
            },
            pre: ({ children }) => {
              const codeElement = Array.isArray(children)
                ? children[0]
                : children
              const codeClass = isValidElement(codeElement)
                ? String(
                    (codeElement.props as { className?: string }).className ??
                      ''
                  )
                : ''
              const language =
                codeClass.match(/language-([\w-]+)/i)?.[1] ?? 'text'
              const codeText = getNodeText(
                isValidElement(codeElement)
                  ? (codeElement.props as { children?: ReactNode }).children
                  : children
              ).replace(/\n$/, '')

              return (
                <div className='not-prose bg-muted/30 my-6 overflow-hidden rounded-xl border'>
                  <div className='bg-muted/70 flex items-center justify-between border-b px-3 py-1.5'>
                    <span className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
                      {language}
                    </span>
                    <CopyButton value={codeText} className='size-7' />
                  </div>
                  <pre className='m-0 overflow-x-auto bg-transparent px-4 py-3 text-[13px] leading-6'>
                    {children}
                  </pre>
                </div>
              )
            },
            code: ({ className, children, ...props }) => {
              const codeContent = getNodeText(children)
              const isBlockCode =
                className?.includes('language-') || codeContent.includes('\n')

              if (!isBlockCode) {
                return (
                  <code
                    className={cn('bg-muted rounded px-1.5 py-0.5', className)}
                    {...props}
                  >
                    {children}
                  </code>
                )
              }

              return (
                <code
                  className={cn(
                    'block min-w-max bg-transparent p-0 font-mono',
                    className
                  )}
                  {...props}
                >
                  {children}
                </code>
              )
            },
            a: ({
              href,
              children,
              target: _,
              node: _node,
              ref: _ref,
              ...props
            }) => {
              if (!href) {
                return <a {...props}>{children}</a>
              }

              const kind = classifyWikiLink(href)

              if (kind === 'attachment') {
                const resolvedHref = resolveAttachmentUrl(href)
                return (
                  <a href={resolvedHref} {...props}>
                    {children}
                  </a>
                )
              }

              if (kind === 'internal') {
                if (href.startsWith('#')) {
                  return (
                    <a
                      href={
                        currentPathWithQuery
                          ? `${currentPathWithQuery}${href}`
                          : href
                      }
                      {...props}
                    >
                      {children}
                    </a>
                  )
                }

                const siblingHref =
                  href.startsWith('/') || href.startsWith('../')
                    ? href
                    : `../${href}`
                const cleanHref = href.split('#')[0].split('?')[0]
                const trimmedHref = cleanHref.replace(/^\//, '')
                const isMissing =
                  missingLinks.includes(cleanHref) ||
                  missingLinks.includes(trimmedHref)

                return (
                  <Link
                    to={siblingHref}
                    {...props}
                    className={cn(
                      'transition-colors',
                      isMissing && '!text-red-600 dark:!text-red-400'
                    )}
                  >
                    {children}
                  </Link>
                )
              }

              return (
                <a
                  href={href}
                  target='_blank'
                  rel='noopener noreferrer'
                  {...props}
                >
                  <span className='inline-flex items-center gap-1'>
                    {children}
                    <ExternalLink className='size-3.5 shrink-0' />
                  </span>
                </a>
              )
            },
          }}
        >
          {content}
        </Markdown>
      </div>

      <ImageLightbox
        images={lightboxMedia}
        currentIndex={currentIndex}
        open={open}
        onOpenChange={(isOpen) => !isOpen && closeLightbox()}
        onIndexChange={setCurrentIndex}
      />
    </>
  )
}
